const XML_DECLARATION = /^\s*<\?xml\s[^?]*\?>/u;
const MAX_PREFERENCES_BYTES = 4 * 1024 * 1024;
const INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const EXCHANGE_RATE_PROVIDER_PATTERN = /^[A-Z][A-Z0-9_-]{0,63}$/;

type PreferenceElementType =
    | "boolean"
    | "float"
    | "int"
    | "long"
    | "set"
    | "string";

interface ParsedElement {
    attributes: ReadonlyMap<string, string>;
    content: string | undefined;
    type: PreferenceElementType;
}

interface AllowedPreference<T> {
    outputName: keyof BackupPreferencesMetadata;
    parse: (element: ParsedElement) => T;
    type: PreferenceElementType;
}

export type BackupPreferencesErrorCode = "INVALID_PREFERENCES_XML";

export class BackupPreferencesError extends Error {
    readonly code: BackupPreferencesErrorCode;

    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.code = "INVALID_PREFERENCES_XML";
        this.name = "BackupPreferencesError";
    }
}

export interface BackupPreferencesMetadata {
    automaticExchangeRateDownload?: boolean;
    currentVersion?: number;
    defaultTransferCategory?: number;
    exchangeRateProvider?: string;
    firstInstallDatabaseSchemaVersion?: number;
    groupMonthStart?: number;
    groupWeekStart?: number;
    historyIncludeTransfers?: boolean;
    homeCurrency?: string;
    transactionTimeEnabled?: boolean;
    unmappedTransactionAsTransfer?: boolean;
    valueDate?: boolean;
}

function preferencesError(message: string, cause?: unknown): BackupPreferencesError {
    return new BackupPreferencesError(
        message,
        cause === undefined ? undefined : { cause },
    );
}

function decodeXmlEntities(value: string): string {
    const withoutSupportedEntities = value.replace(
        /&(?:#\d+|#x[\dA-Fa-f]+|amp|apos|gt|lt|quot);/gu,
        "",
    );
    if (withoutSupportedEntities.includes("&")) {
        throw preferencesError(
            "The preferences XML contains an unsupported entity",
        );
    }

    let decoded: string;
    try {
        decoded = value.replace(
            /&(?:#(\d+)|#x([\dA-Fa-f]+)|amp|apos|gt|lt|quot);/gu,
            (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
                if (decimal !== undefined || hexadecimal !== undefined) {
                    const codePoint = Number.parseInt(
                        decimal ?? hexadecimal ?? "",
                        decimal === undefined ? 16 : 10,
                    );
                    if (
                        !Number.isInteger(codePoint) ||
                        codePoint <= 0 ||
                        codePoint > 0x10ffff ||
                        (codePoint >= 0xd800 && codePoint <= 0xdfff)
                    ) {
                        throw preferencesError(
                            "The preferences XML contains an invalid character entity",
                        );
                    }
                    return String.fromCodePoint(codePoint);
                }
                switch (entity) {
                    case "&amp;":
                        return "&";
                    case "&apos;":
                        return "'";
                    case "&gt;":
                        return ">";
                    case "&lt;":
                        return "<";
                    case "&quot;":
                        return '"';
                    default:
                        throw preferencesError(
                            "The preferences XML contains an unsupported entity",
                        );
                }
            },
        );
    } catch (error) {
        if (error instanceof BackupPreferencesError) {
            throw error;
        }
        throw preferencesError("The preferences XML could not be decoded", error);
    }
    return decoded;
}

function parseAttributes(source: string): ReadonlyMap<string, string> {
    const attributes = new Map<string, string>();
    let position = 0;
    while (position < source.length) {
        const whitespace = /^\s+/u.exec(source.slice(position));
        if (whitespace === null) {
            throw preferencesError("The preferences XML has invalid attributes");
        }
        position += whitespace[0].length;
        if (position === source.length) {
            break;
        }

        const nameMatch = /^[A-Za-z_][\w.-]*/u.exec(source.slice(position));
        if (nameMatch === null) {
            throw preferencesError("The preferences XML has an invalid attribute");
        }
        const name = nameMatch[0];
        position += name.length;
        const equalsMatch = /^\s*=\s*/u.exec(source.slice(position));
        if (equalsMatch === null) {
            throw preferencesError("The preferences XML has an invalid attribute");
        }
        position += equalsMatch[0].length;
        const quote = source[position];
        if (quote !== '"' && quote !== "'") {
            throw preferencesError("The preferences XML has an invalid attribute");
        }
        position++;
        const end = source.indexOf(quote, position);
        if (end === -1) {
            throw preferencesError("The preferences XML has an unterminated attribute");
        }
        if (attributes.has(name)) {
            throw preferencesError("The preferences XML has a duplicate attribute");
        }
        attributes.set(name, decodeXmlEntities(source.slice(position, end)));
        position = end + 1;
    }
    return attributes;
}

function findTagEnd(source: string, start: number): number {
    let quote: '"' | "'" | undefined;
    for (let index = start; index < source.length; index++) {
        const character = source[index];
        if (quote === undefined && (character === '"' || character === "'")) {
            quote = character;
        } else if (quote !== undefined && character === quote) {
            quote = undefined;
        } else if (quote === undefined && character === ">") {
            return index;
        }
    }
    throw preferencesError("The preferences XML has an unterminated tag");
}

function parseOpeningTag(
    source: string,
    start: number,
): { element: ParsedElement; nextPosition: number } {
    const tagEnd = findTagEnd(source, start + 1);
    let tagSource = source.slice(start + 1, tagEnd);
    const selfClosing = /\/\s*$/u.test(tagSource);
    if (selfClosing) {
        tagSource = tagSource.replace(/\/\s*$/u, "");
    }
    const nameMatch = /^([A-Za-z][\w.-]*)/u.exec(tagSource);
    if (nameMatch === null) {
        throw preferencesError("The preferences XML has an invalid element");
    }
    const type = nameMatch[1];
    if (
        type !== "boolean" &&
        type !== "float" &&
        type !== "int" &&
        type !== "long" &&
        type !== "set" &&
        type !== "string"
    ) {
        throw preferencesError("The preferences XML has an unsupported element");
    }
    const attributes = parseAttributes(tagSource.slice(type.length));
    let content: string | undefined;
    let nextPosition = tagEnd + 1;
    if (!selfClosing) {
        if (type !== "string" && type !== "set") {
            throw preferencesError(
                "The preferences XML has a non-scalar primitive element",
            );
        }
        const closingTag = `</${type}>`;
        const closingPosition = source.indexOf(closingTag, nextPosition);
        if (closingPosition === -1) {
            throw preferencesError("The preferences XML has an unclosed element");
        }
        content = source.slice(nextPosition, closingPosition);
        nextPosition = closingPosition + closingTag.length;
        if (type === "string" && content.includes("<")) {
            throw preferencesError(
                "The preferences XML string contains unexpected markup",
            );
        }
    }
    return {
        element: { attributes, content, type },
        nextPosition,
    };
}

function parseBoolean(element: ParsedElement): boolean {
    const value = element.attributes.get("value");
    if (value !== "true" && value !== "false") {
        throw preferencesError(
            "An allowlisted boolean preference has an invalid value",
        );
    }
    return value === "true";
}

function parseInt(element: ParsedElement): number {
    const value = element.attributes.get("value");
    if (value === undefined || !INTEGER_PATTERN.test(value)) {
        throw preferencesError(
            "An allowlisted integer preference has an invalid value",
        );
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < -2_147_483_648 || parsed > 2_147_483_647) {
        throw preferencesError(
            "An allowlisted integer preference is outside the supported range",
        );
    }
    return parsed;
}

function parseLong(element: ParsedElement): number {
    const value = element.attributes.get("value");
    if (value === undefined || !INTEGER_PATTERN.test(value)) {
        throw preferencesError(
            "An allowlisted long preference has an invalid value",
        );
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
        throw preferencesError(
            "An allowlisted long preference is outside the safe integer range",
        );
    }
    return parsed;
}

function parseNumericString(
    element: ParsedElement,
    minimum: number,
    maximum: number,
): number {
    const value = decodeXmlEntities(element.content ?? "");
    if (!INTEGER_PATTERN.test(value)) {
        throw preferencesError(
            "An allowlisted numeric string preference has an invalid value",
        );
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw preferencesError(
            "An allowlisted numeric string preference is outside its range",
        );
    }
    return parsed;
}

function parseCurrency(element: ParsedElement): string {
    const value = decodeXmlEntities(element.content ?? "");
    if (!CURRENCY_PATTERN.test(value)) {
        throw preferencesError(
            "The allowlisted home currency preference is invalid",
        );
    }
    return value;
}

function parseExchangeRateProvider(element: ParsedElement): string {
    const value = decodeXmlEntities(element.content ?? "");
    if (!EXCHANGE_RATE_PROVIDER_PATTERN.test(value)) {
        throw preferencesError(
            "The allowlisted exchange-rate provider preference is invalid",
        );
    }
    return value;
}

const ALLOWED_PREFERENCES = new Map<string, AllowedPreference<unknown>>([
    [
        "automatic_exchange_rate_download",
        {
            outputName: "automaticExchangeRateDownload",
            parse: parseBoolean,
            type: "boolean",
        },
    ],
    [
        "currentversion",
        { outputName: "currentVersion", parse: parseInt, type: "int" },
    ],
    [
        "default_transfer_category",
        {
            outputName: "defaultTransferCategory",
            parse: parseLong,
            type: "long",
        },
    ],
    [
        "exchange_rate_provider",
        {
            outputName: "exchangeRateProvider",
            parse: parseExchangeRateProvider,
            type: "string",
        },
    ],
    [
        "first_install_db_schema_version",
        {
            outputName: "firstInstallDatabaseSchemaVersion",
            parse: parseInt,
            type: "int",
        },
    ],
    [
        "group_month_start",
        {
            outputName: "groupMonthStart",
            parse: (element) => parseNumericString(element, 1, 31),
            type: "string",
        },
    ],
    [
        "group_week_start",
        {
            outputName: "groupWeekStart",
            parse: (element) => parseNumericString(element, 1, 7),
            type: "string",
        },
    ],
    [
        "history_include_transfers",
        {
            outputName: "historyIncludeTransfers",
            parse: parseBoolean,
            type: "boolean",
        },
    ],
    [
        "home_currency",
        { outputName: "homeCurrency", parse: parseCurrency, type: "string" },
    ],
    [
        "transaction_time",
        {
            outputName: "transactionTimeEnabled",
            parse: parseBoolean,
            type: "boolean",
        },
    ],
    [
        "unmapped_transaction_as_transfer",
        {
            outputName: "unmappedTransactionAsTransfer",
            parse: parseBoolean,
            type: "boolean",
        },
    ],
    [
        "value_date",
        {
            outputName: "valueDate",
            parse: parseBoolean,
            type: "boolean",
        },
    ],
]);

function assertElementAttributes(element: ParsedElement): void {
    const expected =
        element.type === "string" || element.type === "set"
            ? new Set(["name"])
            : new Set(["name", "value"]);
    if (
        element.attributes.size !== expected.size ||
        [...element.attributes.keys()].some((name) => !expected.has(name))
    ) {
        throw preferencesError(
            "The preferences XML element has unexpected attributes",
        );
    }
}

/** Parses only non-sensitive metadata from Android SharedPreferences XML. */
export function parseBackupPreferences(
    bytes: Uint8Array,
): BackupPreferencesMetadata {
    if (!(bytes instanceof Uint8Array)) {
        throw preferencesError("Preferences must be provided as bytes");
    }
    if (bytes.byteLength > MAX_PREFERENCES_BYTES) {
        throw preferencesError("Preferences exceed the size limit");
    }

    let source: string;
    try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
        throw preferencesError("The preferences XML is not valid UTF-8", error);
    }
    source = source.replace(/^\uFEFF/u, "");
    source = source.replace(XML_DECLARATION, "").trim();
    if (
        /<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?/iu.test(source) ||
        !source.startsWith("<map>")
    ) {
        throw preferencesError("The preferences XML has an unsafe document form");
    }

    const metadata: BackupPreferencesMetadata = {};
    const assigned = new Set<keyof BackupPreferencesMetadata>();
    let position = "<map>".length;
    while (position < source.length) {
        const whitespace = /^\s*/u.exec(source.slice(position));
        position += whitespace?.[0].length ?? 0;
        if (source.startsWith("</map>", position)) {
            position += "</map>".length;
            if (source.slice(position).trim().length !== 0) {
                throw preferencesError(
                    "The preferences XML contains data after the root element",
                );
            }
            return metadata;
        }
        if (source[position] !== "<" || source.startsWith("</", position)) {
            throw preferencesError("The preferences XML has invalid map content");
        }

        const parsed = parseOpeningTag(source, position);
        position = parsed.nextPosition;
        assertElementAttributes(parsed.element);
        const preferenceName = parsed.element.attributes.get("name");
        if (preferenceName === undefined) {
            throw preferencesError("A preferences XML element has no name");
        }
        const allowed = ALLOWED_PREFERENCES.get(preferenceName);
        if (allowed === undefined) {
            continue;
        }
        if (parsed.element.type !== allowed.type) {
            throw preferencesError(
                "An allowlisted preference has an unexpected primitive type",
            );
        }
        if (assigned.has(allowed.outputName)) {
            throw preferencesError(
                "The preferences XML repeats an allowlisted preference",
            );
        }
        assigned.add(allowed.outputName);
        const value = allowed.parse(parsed.element);
        Object.defineProperty(metadata, allowed.outputName, {
            configurable: true,
            enumerable: true,
            value,
            writable: true,
        });
    }
    throw preferencesError("The preferences XML root element is not closed");
}
