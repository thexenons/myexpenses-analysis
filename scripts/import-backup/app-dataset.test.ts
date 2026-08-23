import assert from "node:assert/strict";
import test from "node:test";

import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { createAppDataset } from "./app-dataset.ts";
import { withBackupDatabase } from "./database.ts";
import { createImportDatabaseFixture } from "./test-fixtures.ts";
import type { BudgetUiSettings } from "./ui-settings.ts";
import { adaptV189 } from "./v189/adapter.ts";
import type { V189CanonicalDataset } from "./v189/models.ts";

const PREFERENCES = {
    homeCurrency: "EUR",
    includeTransfers: false,
    monthStart: 1,
    unmappedTransactionsAsTransfers: false,
    weekStart: 2,
} as const;

async function canonicalFixture(): Promise<V189CanonicalDataset> {
    const bytes = await createImportDatabaseFixture();
    return withBackupDatabase(bytes, (database) =>
        adaptV189(database, {
            timeZone: "Europe/Madrid",
            preferences: {
                ...PREFERENCES,
                aggregateNeutral: false,
                dynamicExchangeRatesMode: "PER_ACCOUNT",
            },
        }),
    );
}

function mapFixture(
    canonical: V189CanonicalDataset,
    budgetUiSettings: ReadonlyMap<number, BudgetUiSettings> = new Map(
        canonical.budgets.map((budget) => [
            budget.id,
            { aggregateNeutral: false, filter: null },
        ]),
    ),
) {
    return createAppDataset({
        backupSha256: "a".repeat(64),
        budgetUiSettings,
        canonical,
        databaseSha256: "b".repeat(64),
        preferences: PREFERENCES,
        timeZone: "Europe/Madrid",
    });
}

test("maps allowlisted budget filters to stable entity UUIDs", async () => {
    const canonical = await canonicalFixture();
    const dataset = mapFixture(
        canonical,
        new Map([
            [
                1,
                {
                    aggregateNeutral: true,
                    filter: {
                        type: "and" as const,
                        criteria: [
                            { type: "account_id" as const, values: [1] },
                            { type: "cat_id" as const, values: [10] },
                        ],
                    },
                },
            ],
        ]),
    );

    assert.deepEqual(dataset.budgets[0]?.filter, {
        type: "and",
        criteria: [
            {
                type: "account",
                accountUuids: ["11111111-1111-4111-8111-111111111111"],
            },
            {
                type: "category",
                categoryUuids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"],
            },
        ],
    });
    assert.equal(dataset.budgets[0]?.aggregateNeutral, true);
});

test("maps the canonical fixture through the strict public boundary", async () => {
    const dataset = mapFixture(await canonicalFixture());
    assert.equal(parseBackupDataset(dataset), dataset);
    assert.equal(dataset.preferences.weekStart, 1);
    assert.equal(
        dataset.accounts.find((account) => account.sourceId === 5),
        undefined,
    );
    assert.equal(
        dataset.accounts.find((account) => account.sourceId === 2)?.scope,
        "DEBT",
    );
    assert.equal(
        dataset.postings.find((posting) => posting.sourceId === 14)
            ?.isArchivedContent,
        true,
    );
});

test("rejects unknown native account and payment-method enum values", async () => {
    const canonical = await canonicalFixture();
    const badAccount: V189CanonicalDataset = {
        ...canonical,
        accounts: canonical.accounts.with(0, {
            ...canonical.accounts[0]!,
            typeId: 7,
        }),
    };
    assert.throws(
        () => mapFixture(badAccount),
        /unsupported native account type/iu,
    );

    const badMethod: V189CanonicalDataset = {
        ...canonical,
        paymentMethods: canonical.paymentMethods.with(0, {
            ...canonical.paymentMethods[0]!,
            type: 2,
        }),
    };
    assert.throws(
        () => mapFixture(badMethod),
        /unsupported payment-method type/iu,
    );
});

test("rejects a EUR home currency without two fraction digits", async () => {
    const canonical = await canonicalFixture();
    const eurIndex = canonical.currencies.findIndex(
        (currency) => currency.code === "EUR",
    );
    assert.notEqual(eurIndex, -1);
    const badCurrency: V189CanonicalDataset = {
        ...canonical,
        currencies: canonical.currencies.with(eurIndex, {
            ...canonical.currencies[eurIndex]!,
            fractionDigits: 3,
        }),
    };

    assert.throws(
        () => mapFixture(badCurrency),
        /home currency EUR.*fractionDigits=2/iu,
    );
});

test("rejects broken category, transfer-peer and foreign-FX references", async () => {
    const canonical = await canonicalFixture();
    const badCategory: V189CanonicalDataset = {
        ...canonical,
        postings: canonical.postings.with(0, {
            ...canonical.postings[0]!,
            categoryId: 999,
        }),
    };
    assert.throws(() => mapFixture(badCategory), /unknown reference 999/iu);

    const peerIndex = canonical.postings.findIndex((posting) => posting.id === 5);
    assert.notEqual(peerIndex, -1);
    const badPeer: V189CanonicalDataset = {
        ...canonical,
        postings: canonical.postings.with(peerIndex, {
            ...canonical.postings[peerIndex]!,
            transferPeerId: null,
        }),
    };
    assert.throws(
        () => mapFixture(badPeer),
        /transfer peer is not reciprocal and complete/iu,
    );

    const fxIndex = canonical.postings.findIndex((posting) => posting.id === 9);
    assert.notEqual(fxIndex, -1);
    const badFx: V189CanonicalDataset = {
        ...canonical,
        postings: canonical.postings.with(fxIndex, {
            ...canonical.postings[fxIndex]!,
            fxRateToHome: null,
        }),
    };
    assert.throws(() => mapFixture(badFx), /expected a positive exchange rate/iu);
});

test("rejects policy or hash drift before producing output", async () => {
    const canonical = await canonicalFixture();
    assert.throws(
        () =>
            createAppDataset({
                backupSha256: "not-a-hash",
                budgetUiSettings: new Map(
                    canonical.budgets.map((budget) => [
                        budget.id,
                        { aggregateNeutral: false, filter: null },
                    ]),
                ),
                canonical,
                databaseSha256: "b".repeat(64),
                preferences: PREFERENCES,
                timeZone: "Europe/Madrid",
            }),
        /expected lowercase SHA-256/iu,
    );
    assert.throws(
        () =>
            createAppDataset({
                backupSha256: "a".repeat(64),
                budgetUiSettings: new Map(
                    canonical.budgets.map((budget) => [
                        budget.id,
                        { aggregateNeutral: false, filter: null },
                    ]),
                ),
                canonical,
                databaseSha256: "b".repeat(64),
                preferences: { ...PREFERENCES, weekStart: 1 },
                timeZone: "Europe/Madrid",
            }),
        /adapter policies disagree/iu,
    );
});
