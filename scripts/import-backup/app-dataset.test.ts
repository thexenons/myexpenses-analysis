import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBackupDataset, parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { aggregateKpis } from "../../src/domain/analytics/aggregations.ts";
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

test("preserves source exclusion metadata while including top-level movements and balances in frontend scopes", async () => {
    const bytes = await createImportDatabaseFixture({
        extraSql: ["UPDATE accounts SET exclude_from_totals = 1, opening_balance = 500 WHERE _id = 4"],
    });
    const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, {
        timeZone: "Europe/Madrid", preferences: PREFERENCES,
    }));
    const dataset = mapFixture(canonical);
    const sourceExcludedAccount = dataset.accounts.find((account) => account.sourceId === 4);
    assert.ok(sourceExcludedAccount);
    assert.ok(sourceExcludedAccount.balances);
    assert.equal(sourceExcludedAccount.flags.excludedFromTotals, true);
    assert.equal(sourceExcludedAccount.flags.includedInAll, true);
    assert.equal(sourceExcludedAccount.balances.currentNativeMinor, 550);
    assert.equal(sourceExcludedAccount.balances.historicalHomeMinor, 1_130);
    assert.equal(sourceExcludedAccount.balances.valuationHomeMinor, 1_650);
    assert.equal(dataset.postings.filter((posting) => posting.accountUuid === sourceExcludedAccount.uuid).length, 2);
    assert.equal(canonical.postingsByScope.ALL.some((posting) => posting.accountId === 4), true);
    const normalized = normalizeBackupDataset(dataset);
    for (const [scope, canonicalScope] of [["all", "ALL"], ["realCashFlow", "REAL_CASH"], ["debtsOnly", "DEBT"]] as const) {
        const filtered = applyFilters(normalized, { ...createDefaultFilterState(), scope });
        const totals = aggregateKpis(filtered);
        assert.equal(filtered.accounts.some((account) => account.id === sourceExcludedAccount.uuid), scope !== "debtsOnly");
        assert.equal(totals.periodOpeningBalanceEurMinor, canonical.scopes[canonicalScope].openingBalanceHomeMinor);
        assert.equal(totals.periodClosingBalanceEurMinor, canonical.scopes[canonicalScope].closingFlowBalanceHomeMinor);
    }
    assert.equal(applyFilters(normalized, {
        ...createDefaultFilterState(), accountIds: [sourceExcludedAccount.uuid],
    }).accounts.length, 1);
});

test("includes both transfer peers when a non-debt destination has the source exclusion flag", async () => {
    const bytes = await createImportDatabaseFixture({
        extraSql: ["UPDATE accounts SET exclude_from_totals = 1, type = 1 WHERE _id = 2"],
    });
    const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, {
        timeZone: "Europe/Madrid", preferences: PREFERENCES,
    }));
    const dataset = parseBackupDataset(mapFixture(canonical));
    const transfer = dataset.postings.find((posting) => posting.sourceId === 4);
    const peer = dataset.postings.find((posting) => posting.sourceId === 5);
    assert.ok(transfer);
    assert.ok(peer);
    assert.equal(transfer.transferPeer?.postingId, peer.id);
    assert.equal(peer.transferPeer?.postingId, transfer.id);
    assert.equal(dataset.accounts.find((account) => account.sourceId === 2)?.balances?.currentNativeMinor, 250);
    const normalized = normalizeBackupDataset(dataset);
    const filtered = applyFilters(normalized, createDefaultFilterState());
    assert.equal(filtered.postings.some((posting) => posting.id === peer.id), true);
    assert.equal(aggregateKpis(filtered).periodClosingBalanceEurMinor, canonical.scopes.ALL.closingFlowBalanceHomeMinor);
});

test("includes debt and non-debt top-level accounts regardless of the source exclusion flag", async () => {
    const bytes = await createImportDatabaseFixture({
        extraSql: ["UPDATE accounts SET exclude_from_totals = 1 WHERE _id IN (2, 3)"],
    });
    const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, {
        timeZone: "Europe/Madrid", preferences: PREFERENCES,
    }));
    const dataset = parseBackupDataset(mapFixture(canonical));
    const debt = dataset.accounts.find((account) => account.sourceId === 2)!;
    const nonDebt = dataset.accounts.find((account) => account.sourceId === 3)!;
    assert.equal(debt.nativeType, "LIABILITY");
    assert.equal(debt.flags.excludedFromTotals, true);
    assert.equal(debt.flags.includedInAll, true);
    assert.equal(nonDebt.flags.excludedFromTotals, true);
    assert.equal(nonDebt.flags.includedInAll, true);
    assert.equal(canonical.scopes.DEBT.accountIds.includes(2), true);
    assert.equal(canonical.scopes.ALL.accountIds.includes(2), true);
    assert.equal(canonical.scopes.ALL.accountIds.includes(3), true);
    const normalized = normalizeBackupDataset(dataset);
    for (const [scope, canonicalScope] of [["all", "ALL"], ["realCashFlow", "REAL_CASH"], ["debtsOnly", "DEBT"]] as const) {
        const filtered = applyFilters(normalized, { ...createDefaultFilterState(), scope });
        const totals = aggregateKpis(filtered);
        assert.equal(filtered.accounts.some((account) => account.id === debt.uuid), scope !== "realCashFlow");
        assert.equal(filtered.accounts.some((account) => account.id === nonDebt.uuid), scope !== "debtsOnly");
        assert.equal(totals.periodOpeningBalanceEurMinor, canonical.scopes[canonicalScope].openingBalanceHomeMinor);
        assert.equal(totals.periodClosingBalanceEurMinor, canonical.scopes[canonicalScope].closingFlowBalanceHomeMinor);
    }
    assert.equal(
        canonical.scopes.ALL.closingFlowBalanceHomeMinor,
        canonical.scopes.DEBT.closingFlowBalanceHomeMinor + canonical.scopes.REAL_CASH.closingFlowBalanceHomeMinor,
    );
});

test("keeps child debt accounts outside app totals while ignoring source exclusion flags", async () => {
    const bytes = await createImportDatabaseFixture({
        extraSql: ["UPDATE accounts SET exclude_from_totals = 1, parent_id = 1 WHERE _id = 2"],
    });
    const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, {
        timeZone: "Europe/Madrid", preferences: PREFERENCES,
    }));
    const dataset = parseBackupDataset(mapFixture(canonical));
    const childDebt = dataset.accounts.find((account) => account.sourceId === 2)!;
    assert.equal(childDebt.nativeType, "LIABILITY");
    assert.equal(childDebt.flags.excludedFromTotals, true);
    assert.equal(childDebt.flags.includedInAll, false);
    assert.notEqual(childDebt.parentUuid, null);
    assert.equal(canonical.scopes.DEBT.accountIds.includes(2), false);
    const filtered = applyFilters(normalizeBackupDataset(dataset), {
        ...createDefaultFilterState(), scope: "debtsOnly",
    });
    assert.equal(filtered.accounts.some((account) => account.id === childDebt.uuid), false);
});

test("preserves zero dynamic equivalents without inventing an exchange rate", async () => {
    const bytes = await createImportDatabaseFixture({
        extraSql: [
            "UPDATE equivalent_amounts SET equivalent_amount = 0 WHERE transaction_id IN (10, 11)",
        ],
    });
    const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, {
        timeZone: "Europe/Madrid", preferences: PREFERENCES,
    }));
    const dataset = parseBackupDataset(mapFixture(canonical));
    for (const [sourceId, fxSource] of [[10, "DYNAMIC_EQUIVALENT"], [12, "DYNAMIC_SPLIT_PRORATION"]] as const) {
        const posting = dataset.postings.find((entry) => entry.sourceId === sourceId);
        assert.ok(posting);
        assert.notEqual(posting.amountNativeMinor, 0);
        assert.equal(posting.amountHomeMinor, 0);
        assert.equal(posting.exchangeRateToHome, null);
        assert.equal(posting.fxSource, fxSource);
    }
});

test("rejects a non-zero dynamic equivalent for a zero native amount", async () => {
    const bytes = await createImportDatabaseFixture({
        extraSql: ["UPDATE transactions SET amount = 0 WHERE _id = 10"],
    });
    await assert.rejects(
        withBackupDatabase(bytes, (database) => adaptV189(database, {
            timeZone: "Europe/Madrid", preferences: PREFERENCES,
        })),
        /non-zero equivalent for a zero native amount/u,
    );
});

for (const empty of [true, false]) {
    test(`imports static foreign accounts without an exchange rate: ${empty ? "empty" : "zero postings"}`, async () => {
        const bytes = await createImportDatabaseFixture({
            extraSql: [
                "DELETE FROM account_exchangerates WHERE account_id = 3",
                "DELETE FROM equivalent_amounts WHERE transaction_id = 9",
                empty
                    ? "DELETE FROM transactions WHERE _id = 9"
                    : "UPDATE transactions SET amount = 0 WHERE _id = 9",
            ],
        });
        const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, {
            timeZone: "Europe/Madrid", preferences: PREFERENCES,
        }));
        const dataset = parseBackupDataset(mapFixture(canonical));
        const account = dataset.accounts.find((entry) => entry.sourceId === 3);
        assert.ok(account);
        assert.equal(account.exchangeRateMode, "STATIC");
        assert.equal(account.exchangeRateToHome, null);
        assert.equal(account.openingNativeMinor, 0);
        assert.equal(account.openingHomeMinor, 0);
        assert.deepEqual(account.balances, {
            currentNativeMinor: 0,
            historicalHomeMinor: 0,
            valuationHomeMinor: 0,
        });
        const posting = dataset.postings.find((entry) => entry.sourceId === 9);
        if (empty) {
            assert.equal(posting, undefined);
        } else {
            assert.ok(posting);
            assert.equal(posting.amountNativeMinor, 0);
            assert.equal(posting.amountHomeMinor, 0);
            assert.equal(posting.exchangeRateToHome, null);
            assert.equal(posting.fxSource, "ZERO_AMOUNT_WITHOUT_RATE");
        }
    });
}

test("requires a static rate for offsetting postings even when every account balance is zero", async () => {
    const original = await canonicalFixture();
    const accountIndex = original.accounts.findIndex((account) => account.id === 3);
    const account = original.accounts[accountIndex]!;
    const positivePosting = original.postings.find((posting) => posting.accountId === 3)!;
    const negativePosting = {
        ...positivePosting,
        id: 100,
        uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbff",
        amountMinor: -positivePosting.amountMinor,
        amountHomeMinor: -positivePosting.amountHomeMinor,
    };
    const canonical: V189CanonicalDataset = {
        ...original,
        metadata: {
            ...original.metadata,
            counts: { ...original.metadata.counts, postings: original.postings.length + 1 },
        },
        accounts: original.accounts.with(accountIndex, {
            ...account,
            exchangeRateToHome: null,
            openingBalanceMinor: 0,
            openingBalanceHomeMinor: 0,
            nativeClosingBalanceMinor: 0,
            historicalClosingBalanceHomeMinor: 0,
            valuationBalanceHomeMinor: 0,
        }),
        postings: [...original.postings, negativePosting],
    };
    assert.throws(
        () => mapFixture(canonical),
        /STATIC account requires an exchange rate for non-zero amounts/u,
    );
    assert.throws(() => mapFixture({
        ...canonical,
        postings: canonical.postings.map((posting) => posting.accountId === 3
            ? Object.assign({}, posting, { isVoid: true, reconciliationStatus: "VOID" as const })
            : posting),
    }), /STATIC account requires an exchange rate for non-zero amounts/u);
});

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
