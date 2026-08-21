import { readOptionalJsonFile, writeJsonAtomically } from "../files.ts";
import type { IsoDate, ParsedAccount } from "../types.ts";

export type { IsoDate } from "../types.ts";

export const DEFAULT_CURRENCY = "EUR" as const;
export const FRANKFURTER_API_URL = "https://api.frankfurter.dev/v1";

export type Currency = ParsedAccount["currency"];

export interface ExchangeRate {
    base: Currency;
    effectiveDate: IsoDate;
    quote: typeof DEFAULT_CURRENCY;
    rate: number;
    requestedDate: IsoDate;
}

export interface ExchangeRateProvider {
    readonly source: string;
    getRate(
        requestedDate: IsoDate,
        base: Currency,
        quote: typeof DEFAULT_CURRENCY,
    ): Promise<ExchangeRate>;
}

interface ExchangeRateCache {
    rates: Record<string, ExchangeRate>;
    schemaVersion: 1;
    source: typeof FRANKFURTER_API_URL;
}

interface FrankfurterResponse {
    amount: number;
    base: string;
    date: string;
    rates: Record<string, unknown>;
}

export interface FrankfurterExchangeRateProviderOptions {
    apiUrl?: string;
    baseRetryDelayMs?: number;
    cacheFilePath: string;
    fetchImplementation?: typeof fetch;
    maxAttempts?: number;
    timeoutMs?: number;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function cacheKey(
    requestedDate: IsoDate,
    base: Currency,
    quote: typeof DEFAULT_CURRENCY,
): string {
    return `${requestedDate}|${base}|${quote}`;
}

function isCurrency(value: unknown): value is Currency {
    return typeof value === "string" && CURRENCY_PATTERN.test(value);
}

function isIsoDate(value: unknown): value is IsoDate {
    if (typeof value !== "string") {
        return false;
    }

    const match = ISO_DATE_PATTERN.exec(value);
    if (match === null) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
    );
}

function validateExchangeRate(
    value: unknown,
    expectedKey?: string,
): ExchangeRate {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid cached exchange rate${expectedKey ? ` for ${expectedKey}` : ""}`);
    }

    const candidate = value as Partial<ExchangeRate>;
    if (
        !isCurrency(candidate.base) ||
        candidate.quote !== DEFAULT_CURRENCY ||
        !isIsoDate(candidate.requestedDate) ||
        !isIsoDate(candidate.effectiveDate) ||
        typeof candidate.rate !== "number" ||
        !Number.isFinite(candidate.rate) ||
        candidate.rate <= 0 ||
        candidate.effectiveDate > candidate.requestedDate
    ) {
        throw new Error(`Invalid cached exchange rate${expectedKey ? ` for ${expectedKey}` : ""}`);
    }

    if (
        expectedKey !== undefined &&
        cacheKey(candidate.requestedDate, candidate.base, candidate.quote) !==
            expectedKey
    ) {
        throw new Error(`Exchange-rate cache key does not match entry ${expectedKey}`);
    }

    return candidate as ExchangeRate;
}

function parseCache(value: unknown): ExchangeRateCache {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Invalid exchange-rate cache");
    }

    const candidate = value as Partial<ExchangeRateCache>;
    if (
        candidate.schemaVersion !== 1 ||
        candidate.source !== FRANKFURTER_API_URL ||
        typeof candidate.rates !== "object" ||
        candidate.rates === null ||
        Array.isArray(candidate.rates)
    ) {
        throw new Error("Unsupported or invalid exchange-rate cache");
    }

    const rates: Record<string, ExchangeRate> = Object.create(null);
    for (const [key, rate] of Object.entries(candidate.rates)) {
        rates[key] = validateExchangeRate(rate, key);
    }

    return {
        rates,
        schemaVersion: 1,
        source: FRANKFURTER_API_URL,
    };
}

function validateFrankfurterResponse(
    value: unknown,
    requestedDate: IsoDate,
    base: Currency,
    quote: typeof DEFAULT_CURRENCY,
): ExchangeRate {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Frankfurter returned a non-object response");
    }

    const response = value as Partial<FrankfurterResponse>;
    const rate = response.rates?.[quote];
    if (
        response.amount !== 1 ||
        response.base !== base ||
        !isIsoDate(response.date) ||
        response.date > requestedDate ||
        typeof rate !== "number" ||
        !Number.isFinite(rate) ||
        rate <= 0
    ) {
        throw new Error(
            `Frankfurter returned an invalid ${base}/${quote} rate for ${requestedDate}`,
        );
    }

    return {
        base,
        effectiveDate: response.date,
        quote,
        rate,
        requestedDate,
    };
}

function retryAfterMs(response: Response, fallbackMs: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter === null) {
        return fallbackMs;
    }

    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1_000, 10_000);
    }

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
        return Math.min(Math.max(date - Date.now(), 0), 10_000);
    }

    return fallbackMs;
}

async function wait(milliseconds: number): Promise<void> {
    if (milliseconds <= 0) {
        return;
    }
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
    readonly source = FRANKFURTER_API_URL;
    readonly #apiUrl: string;
    readonly #baseRetryDelayMs: number;
    readonly #cacheFilePath: string;
    readonly #fetch: typeof fetch;
    readonly #inFlight = new Map<string, Promise<ExchangeRate>>();
    readonly #maxAttempts: number;
    readonly #timeoutMs: number;
    #cache: ExchangeRateCache | undefined;
    #cachePromise: Promise<ExchangeRateCache> | undefined;
    #dirty = false;

    constructor(options: FrankfurterExchangeRateProviderOptions) {
        this.#apiUrl = (options.apiUrl ?? FRANKFURTER_API_URL).replace(/\/$/, "");
        this.#baseRetryDelayMs = options.baseRetryDelayMs ?? 250;
        this.#cacheFilePath = options.cacheFilePath;
        this.#fetch = options.fetchImplementation ?? fetch;
        this.#maxAttempts = options.maxAttempts ?? 3;
        this.#timeoutMs = options.timeoutMs ?? 10_000;
        if (!Number.isInteger(this.#maxAttempts) || this.#maxAttempts < 1) {
            throw new Error("maxAttempts must be a positive integer");
        }
    }

    async getRate(
        requestedDate: IsoDate,
        base: Currency,
        quote: typeof DEFAULT_CURRENCY,
    ): Promise<ExchangeRate> {
        if (!isIsoDate(requestedDate)) {
            throw new Error(`Invalid exchange-rate date: ${requestedDate}`);
        }
        if (!isCurrency(base) || quote !== DEFAULT_CURRENCY) {
            throw new Error(`Unsupported currency conversion: ${base}/${quote}`);
        }
        if (base === quote) {
            return {
                base,
                effectiveDate: requestedDate,
                quote,
                rate: 1,
                requestedDate,
            };
        }

        const key = cacheKey(requestedDate, base, quote);
        const existingRequest = this.#inFlight.get(key);
        if (existingRequest !== undefined) {
            return existingRequest;
        }

        const request = this.#getCachedOrFetchRate(
            key,
            requestedDate,
            base,
            quote,
        ).finally(() => {
            this.#inFlight.delete(key);
        });
        this.#inFlight.set(key, request);
        return request;
    }

    async flush(): Promise<void> {
        if (!this.#dirty || this.#cache === undefined) {
            return;
        }

        await writeJsonAtomically(this.#cacheFilePath, this.#cache);
        this.#dirty = false;
    }

    async #getCachedOrFetchRate(
        key: string,
        requestedDate: IsoDate,
        base: Currency,
        quote: typeof DEFAULT_CURRENCY,
    ): Promise<ExchangeRate> {
        const cache = await this.#loadCache();
        if (Object.hasOwn(cache.rates, key)) {
            return cache.rates[key]!;
        }

        return this.#fetchRate(requestedDate, base, quote);
    }

    async #fetchRate(
        requestedDate: IsoDate,
        base: Currency,
        quote: typeof DEFAULT_CURRENCY,
    ): Promise<ExchangeRate> {
        const url = new URL(`${this.#apiUrl}/${requestedDate}`);
        url.searchParams.set("base", base);
        url.searchParams.set("symbols", quote);

        const response = await this.#fetchWithRetry(url, base, quote, requestedDate);

        let body: unknown;
        try {
            body = await response.json();
        } catch (error) {
            throw new Error("Frankfurter returned invalid JSON", { cause: error });
        }

        const rate = validateFrankfurterResponse(
            body,
            requestedDate,
            base,
            quote,
        );
        const cache = await this.#loadCache();
        cache.rates[cacheKey(requestedDate, base, quote)] = rate;
        this.#dirty = true;
        return rate;
    }

    async #fetchWithRetry(
        url: URL,
        base: Currency,
        quote: typeof DEFAULT_CURRENCY,
        requestedDate: IsoDate,
    ): Promise<Response> {
        let lastNetworkError: unknown;
        for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
            let response: Response;
            try {
                // eslint-disable-next-line no-await-in-loop -- retry attempts must remain sequential
                response = await this.#fetch(url, {
                    headers: { accept: "application/json" },
                    signal: AbortSignal.timeout(this.#timeoutMs),
                });
            } catch (error) {
                lastNetworkError = error;
                if (attempt < this.#maxAttempts) {
                    // eslint-disable-next-line no-await-in-loop -- backoff belongs to this retry attempt
                    await wait(this.#baseRetryDelayMs * 2 ** (attempt - 1));
                    continue;
                }
                break;
            }

            if (response.ok) {
                return response;
            }

            const retryable = response.status === 429 || response.status >= 500;
            if (retryable && attempt < this.#maxAttempts) {
                // eslint-disable-next-line no-await-in-loop -- respect Retry-After before the next attempt
                await wait(
                    retryAfterMs(
                        response,
                        this.#baseRetryDelayMs * 2 ** (attempt - 1),
                    ),
                );
                continue;
            }

            throw new Error(
                `Frankfurter returned HTTP ${response.status} for ${base}/${quote} on ${requestedDate}`,
            );
        }

        throw new Error(
            `Could not fetch ${base}/${quote} rate for ${requestedDate}`,
            { cause: lastNetworkError },
        );
    }

    async #loadCache(): Promise<ExchangeRateCache> {
        if (this.#cache !== undefined) {
            return this.#cache;
        }
        if (this.#cachePromise !== undefined) {
            return this.#cachePromise;
        }

        this.#cachePromise = this.#readCache();
        this.#cache = await this.#cachePromise;

        return this.#cache;
    }

    async #readCache(): Promise<ExchangeRateCache> {
        const value = await readOptionalJsonFile(this.#cacheFilePath);
        if (value === undefined) {
            return {
                rates: Object.create(null),
                schemaVersion: 1,
                source: FRANKFURTER_API_URL,
            };
        }
        return parseCache(value);
    }
}

export function convertMinorUnits(
    sourceMinorUnits: number,
    rate: number,
): number {
    if (!Number.isSafeInteger(sourceMinorUnits)) {
        throw new Error(`Unsafe source amount in minor units: ${sourceMinorUnits}`);
    }
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid exchange rate: ${rate}`);
    }

    return (
        Math.sign(sourceMinorUnits) *
        Math.round(Math.abs(sourceMinorUnits) * rate)
    );
}
