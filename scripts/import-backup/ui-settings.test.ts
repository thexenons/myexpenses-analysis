import assert from "node:assert/strict";
import test from "node:test";

import {
    BudgetUiSettingsError,
    parseBudgetUiSettings,
} from "./ui-settings.ts";

function concat(...values: readonly Uint8Array[]): Uint8Array {
    const length = values.reduce((total, value) => total + value.byteLength, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const value of values) {
        result.set(value, offset);
        offset += value.byteLength;
    }
    return result;
}

function varint(value: number): Uint8Array {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error("Fixture varint must be a non-negative safe integer");
    }
    const result: number[] = [];
    let remaining = value;
    do {
        const byte = remaining % 128;
        remaining = Math.floor(remaining / 128);
        result.push(byte | (remaining > 0 ? 0x80 : 0));
    } while (remaining > 0);
    return Uint8Array.from(result);
}

function lengthDelimited(field: number, value: Uint8Array): Uint8Array {
    return concat(varint(field * 8 + 2), varint(value.byteLength), value);
}

function utf8(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

function stringValue(value: string): Uint8Array {
    return lengthDelimited(5, utf8(value));
}

function booleanValue(value: boolean): Uint8Array {
    return concat(varint(8), varint(value ? 1 : 0));
}

function preferenceEntry(key: string, value: Uint8Array): Uint8Array {
    return lengthDelimited(
        1,
        concat(lengthDelimited(1, utf8(key)), lengthDelimited(2, value)),
    );
}

function preferenceMap(
    entries: readonly { key: string; value: Uint8Array }[],
): Uint8Array {
    return concat(
        ...entries.map((entry) => preferenceEntry(entry.key, entry.value)),
    );
}

test("reads only requested budget keys and discards labels", () => {
    const filter = JSON.stringify({
        type: "and",
        criteria: [
            {
                type: "account_id",
                label: "private account labels",
                values: [5, 13, 25, 2, 1, 26, 32],
            },
            {
                type: "cat_id",
                label: "private category labels",
                values: [283, 287],
            },
        ],
    });
    const bytes = preferenceMap([
        { key: "private_token", value: Uint8Array.from([0xff]) },
        { key: "budgetFilter_999", value: stringValue("not-json") },
        { key: "budgetFilter_32", value: stringValue(filter) },
        { key: "budgetAggregateNeutral_32", value: booleanValue(true) },
    ]);

    const result = parseBudgetUiSettings(bytes, [32, 33]);
    assert.deepEqual(result.get(32), {
        aggregateNeutral: true,
        filter: {
            type: "and",
            criteria: [
                { type: "account_id", values: [5, 13, 25, 2, 1, 26, 32] },
                { type: "cat_id", values: [283, 287] },
            ],
        },
    });
    assert.deepEqual(result.get(33), {
        aggregateNeutral: false,
        filter: null,
    });
    assert.doesNotMatch(JSON.stringify(result.get(32)), /private/iu);
});

test("supports recursive logical nodes and every confirmed leaf shape", () => {
    const filter = JSON.stringify({
        type: "or",
        criteria: [
            {
                type: "not",
                criterion: {
                    type: "payee_id",
                    label: "ignored",
                    values: [],
                },
            },
            { type: "cr_status", values: ["CLEARED", "RECONCILED"] },
            { type: "date", operation: "BTW", values: ["2026-01-01", "2026-01-31"] },
            {
                type: "amount",
                operation: "GTE",
                values: [-100],
                currency: "EUR",
                sign: false,
            },
            { type: "comment", searchString: null },
            { type: "method_id", label: "ignored", values: [1] },
            { type: "tag_id", label: "ignored", values: [2] },
            { type: "transfer_account", label: "ignored", values: [3] },
        ],
    });
    const result = parseBudgetUiSettings(
        preferenceMap([{ key: "budgetFilter_7", value: stringValue(filter) }]),
        [7],
    );
    const parsed = result.get(7)?.filter;
    assert.equal(parsed?.type, "or");
    assert.equal(parsed.type === "or" ? parsed.criteria.length : 0, 8);
});

test("returns safe defaults when DataStore or keys are absent", () => {
    assert.deepEqual(
        [...parseBudgetUiSettings(undefined, [1, 2])],
        [
            [1, { aggregateNeutral: false, filter: null }],
            [2, { aggregateNeutral: false, filter: null }],
        ],
    );
    assert.deepEqual(
        parseBudgetUiSettings(preferenceMap([]), [1]).get(1),
        { aggregateNeutral: false, filter: null },
    );
});

test("rejects malformed wire data, duplicate keys and wrong value types", () => {
    assert.throws(
        () => parseBudgetUiSettings(Uint8Array.from([0x0a, 0x05, 0x01]), [1]),
        /truncated message/iu,
    );
    assert.throws(
        () => parseBudgetUiSettings(Uint8Array.from([0x08, 0x01]), [1]),
        /preferences field must be length-delimited/iu,
    );
    assert.throws(
        () =>
            parseBudgetUiSettings(
                preferenceMap([
                    { key: "budgetFilter_1", value: stringValue('{"type":"comment","searchString":null}') },
                    { key: "budgetFilter_1", value: stringValue('{"type":"comment","searchString":null}') },
                ]),
                [1],
            ),
        /duplicate requested key/iu,
    );
    assert.throws(
        () =>
            parseBudgetUiSettings(
                preferenceMap([
                    { key: "budgetFilter_1", value: booleanValue(true) },
                ]),
                [1],
            ),
        /expected exactly one string/iu,
    );
    assert.throws(
        () =>
            parseBudgetUiSettings(
                preferenceMap([
                    {
                        key: "budgetAggregateNeutral_1",
                        value: stringValue("true"),
                    },
                ]),
                [1],
            ),
        /expected exactly one boolean/iu,
    );
});

test("rejects unsafe JSON shapes, unsupported nodes and resource abuse", () => {
    const parseFilter = (value: unknown) =>
        parseBudgetUiSettings(
            preferenceMap([
                {
                    key: "budgetFilter_1",
                    value: stringValue(JSON.stringify(value)),
                },
            ]),
            [1],
        );
    assert.throws(
        () =>
            parseFilter({
                type: "account_id",
                label: "ignored",
                values: [1],
                unexpected: true,
            }),
        /unexpected property/iu,
    );
    assert.throws(
        () => parseFilter({ type: "unknown" }),
        /unsupported type/iu,
    );
    assert.throws(
        () =>
            parseFilter({
                type: "account_id",
                label: "ignored",
                values: [Number.MAX_SAFE_INTEGER + 1],
            }),
        /safe integer/iu,
    );
    let nested: unknown = {
        type: "comment",
        searchString: null,
    };
    for (let index = 0; index < 34; index++) {
        nested = { type: "not", criterion: nested };
    }
    assert.throws(() => parseFilter(nested), /depth limit/iu);
    assert.throws(
        () => parseBudgetUiSettings(undefined, [1, 1]),
        /contain duplicates/iu,
    );
    assert.throws(
        () => parseBudgetUiSettings(undefined, [0]),
        /positive safe integers/iu,
    );
});

test("rejects malformed UTF-8 in preference keys", () => {
    const malformedEntry = lengthDelimited(
        1,
        concat(
            lengthDelimited(1, Uint8Array.from([0xc3, 0x28])),
            lengthDelimited(2, stringValue("ignored")),
        ),
    );
    assert.throws(
        () => parseBudgetUiSettings(malformedEntry, [1]),
        (error: unknown) =>
            error instanceof BudgetUiSettingsError &&
            /invalid UTF-8/iu.test(error.message),
    );
});
