const MAX_UI_SETTINGS_BYTES = 4 * 1024 * 1024;
const MAX_PREFERENCE_ENTRIES = 4_096;
const MAX_PREFERENCE_KEY_BYTES = 256;
const MAX_FILTER_JSON_BYTES = 256 * 1024;
const MAX_FILTER_DEPTH = 32;
const MAX_FILTER_NODES = 256;
const MAX_FILTER_VALUES = 1_024;
const MAX_FILTER_STRING_LENGTH = 4_096;

const ID_FILTER_TYPES = new Set([
    "account_id",
    "cat_id",
    "method_id",
    "payee_id",
    "tag_id",
    "transfer_account",
] as const);
const OPERATIONS = new Set([
    "NOPE",
    "EQ",
    "NEQ",
    "GT",
    "GTE",
    "LT",
    "LTE",
    "BTW",
    "IS_NULL",
    "LIKE",
    "IN",
    "IS_NULL_OR_BLANK",
] as const);
const RECONCILIATION_STATUSES = new Set([
    "UNRECONCILED",
    "CLEARED",
    "RECONCILED",
    "VOID",
] as const);

type IdFilterType =
    | "account_id"
    | "cat_id"
    | "method_id"
    | "payee_id"
    | "tag_id"
    | "transfer_account";
type BudgetFilterOperation =
    | "NOPE"
    | "EQ"
    | "NEQ"
    | "GT"
    | "GTE"
    | "LT"
    | "LTE"
    | "BTW"
    | "IS_NULL"
    | "LIKE"
    | "IN"
    | "IS_NULL_OR_BLANK";
type BudgetFilterStatus =
    | "UNRECONCILED"
    | "CLEARED"
    | "RECONCILED"
    | "VOID";

export type BudgetFilterSource =
    | {
          readonly type: "and" | "or";
          readonly criteria: readonly BudgetFilterSource[];
      }
    | { readonly type: "not"; readonly criterion: BudgetFilterSource }
    | { readonly type: IdFilterType; readonly values: readonly number[] }
    | {
          readonly type: "cr_status";
          readonly values: readonly BudgetFilterStatus[];
      }
    | {
          readonly type: "date";
          readonly operation: BudgetFilterOperation;
          readonly values: readonly string[];
      }
    | {
          readonly type: "amount";
          readonly operation: BudgetFilterOperation;
          readonly values: readonly number[];
          readonly currency: string;
          readonly sign: boolean;
      }
    | { readonly type: "comment"; readonly searchString: string | null };

export interface BudgetUiSettings {
    readonly aggregateNeutral: boolean;
    readonly filter: BudgetFilterSource | null;
}

export class BudgetUiSettingsError extends Error {
    override readonly name = "BudgetUiSettingsError";
}

class WireReader {
    readonly bytes: Uint8Array;
    offset = 0;

    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
    }

    get done(): boolean {
        return this.offset === this.bytes.byteLength;
    }

    readVarint(context: string): number {
        let result = 0n;
        let shift = 0n;
        for (let index = 0; index < 10; index++) {
            const byte = this.bytes[this.offset];
            if (byte === undefined) {
                throw new BudgetUiSettingsError(`${context}: truncated varint`);
            }
            this.offset++;
            result |= BigInt(byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) {
                if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
                    throw new BudgetUiSettingsError(
                        `${context}: varint exceeds the safe integer range`,
                    );
                }
                return Number(result);
            }
            shift += 7n;
        }
        throw new BudgetUiSettingsError(`${context}: overlong varint`);
    }

    readTag(context: string): { field: number; wire: number } {
        const tag = this.readVarint(`${context} tag`);
        const field = Math.floor(tag / 8);
        const wire = tag & 0x07;
        if (field < 1) {
            throw new BudgetUiSettingsError(`${context}: invalid field number`);
        }
        return { field, wire };
    }

    readLengthDelimited(context: string): Uint8Array {
        const length = this.readVarint(`${context} length`);
        const end = this.offset + length;
        if (end < this.offset || end > this.bytes.byteLength) {
            throw new BudgetUiSettingsError(`${context}: truncated message`);
        }
        const result = this.bytes.subarray(this.offset, end);
        this.offset = end;
        return result;
    }

    skip(wire: number, context: string): void {
        switch (wire) {
            case 0:
                this.readVarint(context);
                return;
            case 1:
                this.skipBytes(8, context);
                return;
            case 2:
                this.readLengthDelimited(context);
                return;
            case 5:
                this.skipBytes(4, context);
                return;
            default:
                throw new BudgetUiSettingsError(
                    `${context}: unsupported protobuf wire type ${wire}`,
                );
        }
    }

    private skipBytes(length: number, context: string): void {
        const end = this.offset + length;
        if (end > this.bytes.byteLength) {
            throw new BudgetUiSettingsError(`${context}: truncated fixed-width value`);
        }
        this.offset = end;
    }
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function decodeUtf8(bytes: Uint8Array, context: string): string {
    try {
        return utf8Decoder.decode(bytes);
    } catch (error) {
        throw new BudgetUiSettingsError(`${context}: invalid UTF-8`, {
            cause: error,
        });
    }
}

function parseMapEntry(bytes: Uint8Array): { key: string; value: Uint8Array } {
    const reader = new WireReader(bytes);
    let key: string | undefined;
    let value: Uint8Array | undefined;
    while (!reader.done) {
        const tag = reader.readTag("Preference entry");
        if (tag.field === 1) {
            if (tag.wire !== 2 || key !== undefined) {
                throw new BudgetUiSettingsError(
                    "Preference entry: invalid or duplicate key",
                );
            }
            const encodedKey = reader.readLengthDelimited("Preference key");
            if (encodedKey.byteLength > MAX_PREFERENCE_KEY_BYTES) {
                throw new BudgetUiSettingsError("Preference key exceeds its size limit");
            }
            key = decodeUtf8(encodedKey, "Preference key");
        } else if (tag.field === 2) {
            if (tag.wire !== 2 || value !== undefined) {
                throw new BudgetUiSettingsError(
                    "Preference entry: invalid or duplicate value",
                );
            }
            value = reader.readLengthDelimited("Preference value");
        } else {
            reader.skip(tag.wire, "Preference entry unknown field");
        }
    }
    if (key === undefined || value === undefined) {
        throw new BudgetUiSettingsError("Preference entry is incomplete");
    }
    return { key, value };
}

function parseStringValue(bytes: Uint8Array, context: string): string {
    const reader = new WireReader(bytes);
    let result: string | undefined;
    while (!reader.done) {
        const tag = reader.readTag(context);
        if (tag.field !== 5 || tag.wire !== 2 || result !== undefined) {
            throw new BudgetUiSettingsError(`${context}: expected exactly one string`);
        }
        const encoded = reader.readLengthDelimited(context);
        if (encoded.byteLength > MAX_FILTER_JSON_BYTES) {
            throw new BudgetUiSettingsError(`${context}: filter exceeds its size limit`);
        }
        result = decodeUtf8(encoded, context);
    }
    if (result === undefined) {
        throw new BudgetUiSettingsError(`${context}: string value is missing`);
    }
    return result;
}

function parseBooleanValue(bytes: Uint8Array, context: string): boolean {
    const reader = new WireReader(bytes);
    let result: boolean | undefined;
    while (!reader.done) {
        const tag = reader.readTag(context);
        if (tag.field !== 1 || tag.wire !== 0 || result !== undefined) {
            throw new BudgetUiSettingsError(`${context}: expected exactly one boolean`);
        }
        const encoded = reader.readVarint(context);
        if (encoded !== 0 && encoded !== 1) {
            throw new BudgetUiSettingsError(`${context}: invalid boolean value`);
        }
        result = encoded === 1;
    }
    if (result === undefined) {
        throw new BudgetUiSettingsError(`${context}: boolean value is missing`);
    }
    return result;
}

type JsonObject = Record<string, unknown>;

function jsonObject(value: unknown, context: string): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new BudgetUiSettingsError(`${context}: expected an object`);
    }
    return value as JsonObject;
}

function exactKeys(
    object: JsonObject,
    expected: readonly string[],
    context: string,
): void {
    const expectedSet = new Set(expected);
    for (const key of expected) {
        if (!Object.hasOwn(object, key)) {
            throw new BudgetUiSettingsError(`${context}: missing property ${key}`);
        }
    }
    for (const key of Object.keys(object)) {
        if (!expectedSet.has(key)) {
            throw new BudgetUiSettingsError(`${context}: unexpected property ${key}`);
        }
    }
}

function stringValue(value: unknown, context: string): string {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > MAX_FILTER_STRING_LENGTH
    ) {
        throw new BudgetUiSettingsError(`${context}: invalid string`);
    }
    return value;
}

function integerValues(value: unknown, context: string): readonly number[] {
    if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) {
        throw new BudgetUiSettingsError(`${context}: invalid values array`);
    }
    const result = value.map((entry, index) => {
        if (!Number.isSafeInteger(entry)) {
            throw new BudgetUiSettingsError(
                `${context}[${index}]: expected a safe integer`,
            );
        }
        return entry as number;
    });
    if (new Set(result).size !== result.length) {
        throw new BudgetUiSettingsError(`${context}: duplicate values`);
    }
    return result;
}

function stringValues(value: unknown, context: string): readonly string[] {
    if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) {
        throw new BudgetUiSettingsError(`${context}: invalid values array`);
    }
    return value.map((entry, index) =>
        stringValue(entry, `${context}[${index}]`),
    );
}

function operation(value: unknown, context: string): BudgetFilterOperation {
    const result = stringValue(value, context);
    if (!OPERATIONS.has(result as BudgetFilterOperation)) {
        throw new BudgetUiSettingsError(`${context}: unsupported operation ${result}`);
    }
    return result as BudgetFilterOperation;
}

interface FilterParseState {
    nodes: number;
}

function parseFilterNode(
    value: unknown,
    state: FilterParseState,
    depth: number,
): BudgetFilterSource {
    if (depth > MAX_FILTER_DEPTH) {
        throw new BudgetUiSettingsError("Budget filter exceeds its depth limit");
    }
    state.nodes++;
    if (state.nodes > MAX_FILTER_NODES) {
        throw new BudgetUiSettingsError("Budget filter exceeds its node limit");
    }
    const context = `Budget filter node ${state.nodes}`;
    const object = jsonObject(value, context);
    const type = stringValue(object.type, `${context}.type`);

    if (type === "and" || type === "or") {
        exactKeys(object, ["type", "criteria"], context);
        if (!Array.isArray(object.criteria) || object.criteria.length === 0) {
            throw new BudgetUiSettingsError(`${context}.criteria: expected entries`);
        }
        return {
            type,
            criteria: object.criteria.map((criterion) =>
                parseFilterNode(criterion, state, depth + 1),
            ),
        };
    }
    if (type === "not") {
        exactKeys(object, ["type", "criterion"], context);
        return {
            type,
            criterion: parseFilterNode(object.criterion, state, depth + 1),
        };
    }
    if (ID_FILTER_TYPES.has(type as IdFilterType)) {
        exactKeys(object, ["type", "label", "values"], context);
        stringValue(object.label, `${context}.label`);
        return {
            type: type as IdFilterType,
            values: integerValues(object.values, `${context}.values`),
        };
    }
    if (type === "cr_status") {
        exactKeys(object, ["type", "values"], context);
        const values = stringValues(object.values, `${context}.values`).map(
            (entry) => {
                if (!RECONCILIATION_STATUSES.has(entry as BudgetFilterStatus)) {
                    throw new BudgetUiSettingsError(
                        `${context}.values: unsupported status ${entry}`,
                    );
                }
                return entry as BudgetFilterStatus;
            },
        );
        return { type, values };
    }
    if (type === "date") {
        exactKeys(object, ["type", "operation", "values"], context);
        return {
            type,
            operation: operation(object.operation, `${context}.operation`),
            values: stringValues(object.values, `${context}.values`),
        };
    }
    if (type === "amount") {
        exactKeys(
            object,
            ["type", "operation", "values", "currency", "sign"],
            context,
        );
        if (typeof object.sign !== "boolean") {
            throw new BudgetUiSettingsError(`${context}.sign: expected a boolean`);
        }
        return {
            type,
            operation: operation(object.operation, `${context}.operation`),
            values: integerValues(object.values, `${context}.values`),
            currency: stringValue(object.currency, `${context}.currency`),
            sign: object.sign,
        };
    }
    if (type === "comment") {
        exactKeys(object, ["type", "searchString"], context);
        if (object.searchString !== null && typeof object.searchString !== "string") {
            throw new BudgetUiSettingsError(
                `${context}.searchString: expected a string or null`,
            );
        }
        if (
            typeof object.searchString === "string" &&
            object.searchString.length > MAX_FILTER_STRING_LENGTH
        ) {
            throw new BudgetUiSettingsError(
                `${context}.searchString: exceeds its size limit`,
            );
        }
        return { type, searchString: object.searchString };
    }
    throw new BudgetUiSettingsError(`${context}: unsupported type ${type}`);
}

function parseFilterJson(source: string): BudgetFilterSource {
    let value: unknown;
    try {
        value = JSON.parse(source) as unknown;
    } catch (error) {
        throw new BudgetUiSettingsError("Budget filter contains invalid JSON", {
            cause: error,
        });
    }
    return parseFilterNode(value, { nodes: 0 }, 0);
}

function requestedBudgetIds(values: readonly number[]): readonly number[] {
    if (values.length > MAX_FILTER_NODES) {
        throw new BudgetUiSettingsError("Too many requested budget IDs");
    }
    const result = values.map((value) => {
        if (!Number.isSafeInteger(value) || value < 1) {
            throw new BudgetUiSettingsError(
                "Budget IDs must be positive safe integers",
            );
        }
        return value;
    });
    if (new Set(result).size !== result.length) {
        throw new BudgetUiSettingsError("Requested budget IDs contain duplicates");
    }
    return result;
}

/**
 * Reads only exact budget keys from AndroidX Preferences DataStore's proto2
 * PreferenceMap. Values belonging to every other setting remain opaque bytes.
 */
export function parseBudgetUiSettings(
    bytes: Uint8Array | undefined,
    budgetIdsInput: readonly number[],
): Map<number, BudgetUiSettings> {
    const budgetIds = requestedBudgetIds(budgetIdsInput);
    const result = new Map<number, BudgetUiSettings>(
        budgetIds.map((id) => [
            id,
            { aggregateNeutral: false, filter: null },
        ]),
    );
    if (bytes === undefined) {
        return result;
    }
    if (!(bytes instanceof Uint8Array)) {
        throw new BudgetUiSettingsError("UI settings must be provided as bytes");
    }
    if (bytes.byteLength > MAX_UI_SETTINGS_BYTES) {
        throw new BudgetUiSettingsError("UI settings exceed the size limit");
    }

    const filterKeyToId = new Map(
        budgetIds.map((id) => [`budgetFilter_${id}`, id]),
    );
    const aggregateKeyToId = new Map(
        budgetIds.map((id) => [`budgetAggregateNeutral_${id}`, id]),
    );
    const seenRequestedKeys = new Set<string>();
    const reader = new WireReader(bytes);
    let entries = 0;
    while (!reader.done) {
        const tag = reader.readTag("PreferenceMap");
        if (tag.field !== 1) {
            reader.skip(tag.wire, "PreferenceMap unknown field");
            continue;
        }
        if (tag.wire !== 2) {
            throw new BudgetUiSettingsError(
                "PreferenceMap: preferences field must be length-delimited",
            );
        }
        entries++;
        if (entries > MAX_PREFERENCE_ENTRIES) {
            throw new BudgetUiSettingsError("PreferenceMap has too many entries");
        }
        const entry = parseMapEntry(
            reader.readLengthDelimited("PreferenceMap entry"),
        );
        const filterBudgetId = filterKeyToId.get(entry.key);
        const aggregateBudgetId = aggregateKeyToId.get(entry.key);
        if (filterBudgetId === undefined && aggregateBudgetId === undefined) {
            continue;
        }
        if (seenRequestedKeys.has(entry.key)) {
            throw new BudgetUiSettingsError(
                `PreferenceMap contains duplicate requested key ${entry.key}`,
            );
        }
        seenRequestedKeys.add(entry.key);
        if (filterBudgetId !== undefined) {
            const current = result.get(filterBudgetId)!;
            result.set(filterBudgetId, {
                ...current,
                filter: parseFilterJson(
                    parseStringValue(entry.value, entry.key),
                ),
            });
        } else {
            const current = result.get(aggregateBudgetId!)!;
            result.set(aggregateBudgetId!, {
                ...current,
                aggregateNeutral: parseBooleanValue(
                    entry.value,
                    entry.key,
                ),
            });
        }
    }
    return result;
}
