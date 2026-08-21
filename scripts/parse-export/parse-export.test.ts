import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { exportData } from "../../data/export.ts";
import type {
    AccountsRegistry,
    CategoriesRegistry,
    ExportData,
    ParsedData,
} from "../types.ts";
import {
    buildAccountsRegistry,
    type AccountIdentity,
} from "./accounts-registry.ts";
import { buildCategoriesRegistry } from "./categories-registry.ts";
import { writeJsonAtomically } from "../files.ts";
import { buildParseExportArtifacts } from "./index.ts";
import { parseExportData } from "./parsed-data.ts";
import {
    ExportDataValidationError,
    validateExportData,
} from "./validation.ts";

const ACCOUNT_UUID = "11111111-1111-4111-8111-111111111111";
const SECOND_ACCOUNT_UUID = "22222222-2222-4222-8222-222222222222";

function createExportFixture(): ExportData {
    return [
        {
            uuid: ACCOUNT_UUID,
            label: "Main",
            currency: "EUR",
            openingBalance: 10,
            transactions: [
                {
                    uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    status: "RECONCILED",
                    date: "01/01/2024 ",
                    amount: 2,
                    category: ["Ingresos", "Otros"],
                    comment: "Direct",
                },
                {
                    uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    status: "VOID",
                    date: "02/01/2024 ",
                    amount: -3,
                    comment: "Parent comment",
                    payee: "Parent payee",
                    tags: ["parent-tag"],
                    splits: [
                        {
                            uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                            date: "02/01/2024 ",
                            amount: -1,
                            category: ["Gastos", "Uno"],
                            comment: "Child comment",
                        },
                        {
                            uuid: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                            date: "02/01/2024 ",
                            amount: -2,
                            category: ["Gastos", "Dos"],
                        },
                    ],
                },
            ],
        },
    ];
}

test("the canonical export passes exhaustive runtime validation", () => {
    assert.equal(validateExportData(exportData), exportData);
});

test("the canonical TypeScript export matches the updated app export", async () => {
    const updatedExport = JSON.parse(
        await readFile(
            new URL("../../data/export-20260821-092252.json", import.meta.url),
            "utf8",
        ),
    ) as unknown;

    assert.deepEqual(updatedExport, exportData);
});

test("tracked parse artifacts are synchronized with the canonical export", async () => {
    const [accountsRegistry, categoriesRegistry, parsedData] = await Promise.all([
        readFile(new URL("../../data/accounts.json", import.meta.url), "utf8").then(
            (source) => JSON.parse(source) as AccountsRegistry,
        ),
        readFile(
            new URL("../../data/categories.json", import.meta.url),
            "utf8",
        ).then((source) => JSON.parse(source) as CategoriesRegistry),
        readFile(
            new URL("../../data/parsed-data.json", import.meta.url),
            "utf8",
        ).then((source) => JSON.parse(source) as ParsedData),
    ]);
    const generated = buildParseExportArtifacts(exportData, accountsRegistry);

    assert.equal(
        JSON.stringify(generated.accountsRegistry),
        JSON.stringify(accountsRegistry),
    );
    assert.equal(
        JSON.stringify(generated.categoriesRegistry),
        JSON.stringify(categoriesRegistry),
    );
    assert.equal(
        JSON.stringify(generated.parsedData),
        JSON.stringify(parsedData),
    );
});

test("parsed postings retain direct, split and VOID provenance", () => {
    const fixture = createExportFixture();
    const parsed = parseExportData(validateExportData(fixture));
    const [direct, firstSplit, secondSplit] = parsed[0]?.transactions ?? [];

    assert.deepEqual(direct, {
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        date: "2024-01-01",
        amount: 2,
        category: ["Ingresos", "Otros"],
        comment: "Direct",
        sourceTransactionUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sourceStatus: "RECONCILED",
        splitIndex: null,
        splitCount: null,
    });
    assert.equal(firstSplit?.uuid, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(firstSplit?.sourceTransactionUuid, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    assert.equal(firstSplit?.sourceStatus, "VOID");
    assert.equal(firstSplit?.splitIndex, 0);
    assert.equal(firstSplit?.splitCount, 2);
    assert.equal(firstSplit?.comment, "Child comment");
    assert.equal(firstSplit?.payee, "Parent payee");
    assert.deepEqual(firstSplit?.tags, ["parent-tag"]);
    assert.deepEqual(firstSplit?.parent, {
        date: "2024-01-02",
        amount: -3,
        comment: "Parent comment",
        tags: ["parent-tag"],
        payee: "Parent payee",
    });
    assert.equal(secondSplit?.sourceStatus, "VOID");
    assert.equal(secondSplit?.splitIndex, 1);
    assert.equal(secondSplit?.comment, "Parent comment");
    assert.equal(fixture[0]?.transactions[0]?.date, "01/01/2024 ");
});

test("validation rejects invalid dates, cent sums and references", () => {
    const badDate = createExportFixture();
    const firstTransaction = badDate[0]?.transactions[0];
    assert.ok(firstTransaction !== undefined);
    firstTransaction.date = "31/02/2024";
    assert.throws(
        () => validateExportData(badDate),
        (error: unknown) =>
            error instanceof ExportDataValidationError &&
            /date does not exist/.test(error.message),
    );

    const badSum = createExportFixture();
    const splitParent = badSum[0]?.transactions[1];
    assert.ok(splitParent !== undefined && "splits" in splitParent);
    splitParent.splits[0]!.amount = -1.01;
    assert.throws(() => validateExportData(badSum), /sum is -301 cents/);

    const mismatchedSplitDate = createExportFixture();
    const mismatchedParent = mismatchedSplitDate[0]?.transactions[1];
    assert.ok(mismatchedParent !== undefined && "splits" in mismatchedParent);
    mismatchedParent.splits[0]!.date = "03/01/2024 ";
    assert.throws(
        () => validateExportData(mismatchedSplitDate),
        /must match the split parent date/,
    );

    const missingPair = createExportFixture();
    const direct = missingPair[0]?.transactions[0];
    assert.ok(direct !== undefined && !("splits" in direct));
    direct.transferAccount = "Missing";
    assert.throws(() => validateExportData(missingPair), /unknown account label/);

    const crossCurrencySameSign: ExportData = [
        {
            uuid: ACCOUNT_UUID,
            label: "EUR account",
            currency: "EUR",
            openingBalance: 0,
            transactions: [
                {
                    uuid: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                    status: "UNRECONCILED",
                    date: "01/01/2024 ",
                    amount: 10,
                    category: ["Transferencia"],
                    transferAccount: "GBP account",
                },
            ],
        },
        {
            uuid: SECOND_ACCOUNT_UUID,
            label: "GBP account",
            currency: "GBP",
            openingBalance: 0,
            transactions: [
                {
                    uuid: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                    status: "UNRECONCILED",
                    date: "01/01/2024 ",
                    amount: 8,
                    category: ["Transferencia"],
                    transferAccount: "EUR account",
                },
            ],
        },
    ];
    assert.throws(
        () => validateExportData(crossCurrencySameSign),
        /must have opposite signs/,
    );
});

test("legacy account labels migrate to UUIDs and UUID entries survive renames", () => {
    const accounts: AccountIdentity[] = [
        { uuid: ACCOUNT_UUID, label: "Old label" },
        { uuid: SECOND_ACCOUNT_UUID, label: "Cash" },
    ];
    const migrated = buildAccountsRegistry(accounts, {
        "Old label": "DEBT",
        Cash: "DEFAULT",
    });

    assert.deepEqual(migrated.accounts[ACCOUNT_UUID], {
        label: "Old label",
        type: "DEBT",
    });
    assert.equal(Object.hasOwn(migrated.accounts, "Old label"), false);

    const configured = {
        ...migrated,
        accounts: {
            ...migrated.accounts,
            [ACCOUNT_UUID]: {
                ...migrated.accounts[ACCOUNT_UUID]!,
                exchangeRateMode: "STATIC" as const,
                exchangeRateToEur: 1.25,
            },
        },
    };
    const renamed = buildAccountsRegistry(
        [
            { uuid: ACCOUNT_UUID, label: "New label" },
            { uuid: SECOND_ACCOUNT_UUID, label: "Cash" },
        ],
        configured,
    );
    assert.deepEqual(renamed.accounts[ACCOUNT_UUID], {
        exchangeRateMode: "STATIC",
        exchangeRateToEur: 1.25,
        label: "New label",
        type: "DEBT",
    });
    assert.throws(
        () => buildAccountsRegistry(accounts, { Unknown: "DEBT" }),
        /Cannot migrate legacy account/,
    );
});

test("versioned account registries reject invalid exchange-rate modes", () => {
    const accounts: AccountIdentity[] = [
        { uuid: ACCOUNT_UUID, label: "Foreign account" },
    ];

    assert.throws(
        () =>
            buildAccountsRegistry(accounts, {
                version: 2,
                accounts: {
                    [ACCOUNT_UUID]: {
                        exchangeRateMode: "AUTOMATIC",
                        label: "Foreign account",
                        type: "DEFAULT",
                    },
                },
            }),
        /Invalid accounts registry entry/,
    );
    assert.equal(
        buildAccountsRegistry(accounts, { "Foreign account": "DEFAULT" })
            .accounts[ACCOUNT_UUID]?.exchangeRateMode,
        undefined,
    );
});

test("versioned account registries reject invalid static EUR rates", () => {
    const accounts: AccountIdentity[] = [
        { uuid: ACCOUNT_UUID, label: "Foreign account" },
    ];

    for (const exchangeRateToEur of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () =>
                buildAccountsRegistry(accounts, {
                    version: 2,
                    accounts: {
                        [ACCOUNT_UUID]: {
                            exchangeRateToEur,
                            label: "Foreign account",
                            type: "DEFAULT",
                        },
                    },
                }),
            /Invalid accounts registry entry/,
        );
    }
});

test("category keys cannot mutate object prototypes", () => {
    const fixture = createExportFixture();
    const direct = fixture[0]?.transactions[0];
    assert.ok(direct !== undefined && !("splits" in direct));
    direct.category = ["__proto__", "constructor"];
    const registry = buildCategoriesRegistry(
        parseExportData(validateExportData(fixture)),
    );

    assert.equal(Object.getPrototypeOf(registry), null);
    assert.equal(Object.hasOwn(registry, "__proto__"), true);
    assert.equal(
        Object.hasOwn(registry.__proto__?.children ?? {}, "constructor"),
        true,
    );
    assert.equal(Object.hasOwn(Object.prototype, "categoryType"), false);
});

test("atomic JSON writes replace the target and clean temporary files", async (context) => {
    const directoryPath = await mkdtemp(join(tmpdir(), "parse-export-test-"));
    context.after(async () => rm(directoryPath, { recursive: true, force: true }));
    const filePath = join(directoryPath, "artifact.json");

    await writeJsonAtomically(filePath, { version: 1 });
    await writeJsonAtomically(filePath, { version: 2 });

    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { version: 2 });
    assert.deepEqual(await readdir(directoryPath), ["artifact.json"]);
});
