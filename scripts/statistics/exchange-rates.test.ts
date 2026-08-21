import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    convertMinorUnits,
    FrankfurterExchangeRateProvider,
    type IsoDate,
} from "./exchange-rates.ts";

function jsonResponse(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json" },
        status,
    });
}

test("fetches a historical v1 rate once and reuses the persistent cache", async () => {
    const directory = await mkdtemp(join(tmpdir(), "myexpenses-fx-test-"));
    const cacheFilePath = join(directory, "exchange-rates.json");
    let calls = 0;
    const fetchImplementation = (async (input: string | URL | Request) => {
        calls++;
        const url = new URL(input.toString());
        assert.equal(url.pathname, "/v1/2024-03-23");
        assert.equal(url.searchParams.get("base"), "GBP");
        assert.equal(url.searchParams.get("symbols"), "EUR");
        return jsonResponse({
            amount: 1,
            base: "GBP",
            date: "2024-03-22",
            rates: { EUR: 1.1656 },
        });
    }) as typeof fetch;

    try {
        const provider = new FrankfurterExchangeRateProvider({
            cacheFilePath,
            fetchImplementation,
        });
        const [first, concurrent] = await Promise.all([
            provider.getRate("2024-03-23", "GBP", "EUR"),
            provider.getRate("2024-03-23", "GBP", "EUR"),
        ]);
        assert.deepEqual(first, concurrent);
        assert.equal(first.effectiveDate, "2024-03-22");
        assert.equal(first.rate, 1.1656);
        assert.equal(calls, 1);
        await provider.flush();

        const offlineProvider = new FrankfurterExchangeRateProvider({
            cacheFilePath,
            fetchImplementation: (async () => {
                throw new Error("network should not be used");
            }) as typeof fetch,
        });
        assert.deepEqual(
            await offlineProvider.getRate("2024-03-23", "GBP", "EUR"),
            first,
        );
        assert.match(await readFile(cacheFilePath, "utf8"), /2024-03-22/);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("EUR is identity and does not access the network", async () => {
    const provider = new FrankfurterExchangeRateProvider({
        cacheFilePath: "/unused/exchange-rates.json",
        fetchImplementation: (async () => {
            throw new Error("network should not be used");
        }) as typeof fetch,
    });

    assert.deepEqual(await provider.getRate("2024-03-23", "EUR", "EUR"), {
        base: "EUR",
        effectiveDate: "2024-03-23",
        quote: "EUR",
        rate: 1,
        requestedDate: "2024-03-23",
    });
});

test("rejects invalid dates and malformed Frankfurter responses", async () => {
    const provider = new FrankfurterExchangeRateProvider({
        cacheFilePath: "/unused/exchange-rates.json",
        fetchImplementation: (async () =>
            jsonResponse({
                amount: 1,
                base: "GBP",
                date: "2024-03-24",
                rates: { EUR: 1.2 },
            })) as typeof fetch,
    });

    await assert.rejects(
        provider.getRate("2024-02-31" as IsoDate, "GBP", "EUR"),
        /Invalid exchange-rate date/,
    );
    await assert.rejects(
        provider.getRate("2024-03-23", "GBP", "EUR"),
        /invalid GBP\/EUR rate/,
    );
});

test("retries transient HTTP errors without caching them", async () => {
    const directory = await mkdtemp(join(tmpdir(), "myexpenses-fx-retry-test-"));
    let calls = 0;
    const provider = new FrankfurterExchangeRateProvider({
        baseRetryDelayMs: 0,
        cacheFilePath: join(directory, "exchange-rates.json"),
        fetchImplementation: (async () => {
            calls++;
            return calls === 1
                ? jsonResponse({ message: "temporary" }, 503)
                : jsonResponse({
                      amount: 1,
                      base: "USD",
                      date: "2024-03-18",
                      rates: { EUR: 0.91811 },
                  });
        }) as typeof fetch,
    });

    try {
        assert.equal(
            (await provider.getRate("2024-03-18", "USD", "EUR")).rate,
            0.91811,
        );
        assert.equal(calls, 2);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rounds converted minor units half away from zero", () => {
    assert.equal(convertMinorUnits(1, 1.5), 2);
    assert.equal(convertMinorUnits(-1, 1.5), -2);
    assert.equal(convertMinorUnits(10_000, 1.1692), 11_692);
    assert.equal(convertMinorUnits(-10_000, 1.1692), -11_692);
});
