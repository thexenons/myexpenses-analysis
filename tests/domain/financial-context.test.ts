import assert from "node:assert/strict";
import test from "node:test";
import { createFinancialContext } from "../../src/domain/analytics/financial-context.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { aggregateKpis } from "../../src/domain/analytics/aggregations.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import { normalizeBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { createAppDataset } from "../../scripts/import-backup/app-dataset.ts";
import { withBackupDatabase } from "../../scripts/import-backup/database.ts";
import { createImportDatabaseFixture } from "../../scripts/import-backup/test-fixtures.ts";
import { adaptV189 } from "../../scripts/import-backup/v189/adapter.ts";

function fixture() {
  return normalizeDataset({
    accounts: { version: 2, accounts: { bank: { label: "Bank", type: "DEFAULT" }, other: { label: "Other", type: "DEFAULT" } } },
    categories: { Food: { categoryType: "EXPENSE" }, Salary: { categoryType: "INCOME" } },
    parsedData: [
      { uuid: "bank", label: "Bank", currency: "EUR", openingBalance: 100, transactions: ([
        { uuid: "history", date: "2024-01-01", amount: 200, category: ["Salary"], comment: "OUTSIDE-HISTORY" },
        { uuid: "food", date: "2024-02-02", amount: -25, category: ["Food"], comment: "Matched purchase" },
        { uuid: "void", date: "2024-02-02", amount: -999, category: ["Food"], sourceStatus: "VOID" },
      ] as const).map((row) => Object.assign({ sourceTransactionUuid: row.uuid, sourceStatus: "RECONCILED" as const, splitIndex: null, splitCount: null }, row)) },
      { uuid: "other", label: "Other", currency: "EUR", openingBalance: 800, transactions: ([
        { uuid: "private", date: "2024-02-02", amount: -70, category: ["Food"], comment: "OUTSIDE-ACCOUNT" },
      ] as const).map((row) => Object.assign({ sourceTransactionUuid: row.uuid, sourceStatus: "RECONCILED" as const, splitIndex: null, splitCount: null }, row)) },
    ],
  });
}
const filters = { ...createDefaultFilterState(), accountIds: ["bank"], dateRange: { from: "2024-02-01" as const, to: "2024-02-29" as const } };
const options = { filters, granularity: "month" as const, exportedAt: "2024-03-01T12:00:00.000Z" };

test("filtered context contains only matching active movements and no historical balances", () => {
  const dataset = fixture();
  const before = JSON.stringify({ dataset, filters });
  const result = createFinancialContext(dataset, { ...options, mode: "filtered" });
  const json = JSON.stringify(result);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.scope.mode, "filtered");
  assert.deepEqual(result.scope.filters, filters);
  assert.deepEqual(result.transactions.map((row) => row.transactionId), ["food"]);
  assert.equal(result.summary.netEurMinor, -2500);
  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0]?.account.id, "bank");
  assert.equal(result.budgets.status, "unavailable");
  assert.equal(result.historicalAnalysis.status, "unavailable");
  for (const forbidden of ["OUTSIDE-HISTORY", "OUTSIDE-ACCOUNT", "periodOpeningBalanceEurMinor", "periodClosingBalanceEurMinor", "valuationBalanceEurMinor", "searchIndex", '"source"']) {
    assert.ok(!json.includes(forbidden), forbidden);
  }
  assert.equal(JSON.stringify({ dataset, filters }), before);
  assert.deepEqual(result.summary, (({ periodOpeningBalanceEurMinor: _opening, periodClosingBalanceEurMinor: _closing, ...metrics }) => metrics)(aggregateKpis(applyFilters(dataset, filters))));
});

test("all-data mode ignores every active filter without mutating the selected view", () => {
  const dataset = fixture();
  const result = createFinancialContext(dataset, { ...options, mode: "all" });
  assert.deepEqual(result.scope.filters, createDefaultFilterState());
  assert.equal(result.scope.isPartial, false);
  assert.deepEqual(result.transactions.map((row) => row.transactionId).sort(), ["food", "history", "private"]);
  assert.deepEqual(result.summary, aggregateKpis(applyFilters(dataset, createDefaultFilterState())));
  assert.equal(result.accounts.length, 2);
  assert.equal(result.historicalAnalysis.status, "available");
  assert.ok(JSON.stringify(result).includes("periodOpeningBalanceEurMinor"));
  assert.equal(filters.accountIds[0], "bank");
});

test("empty selections remain explicit and never pull in source data", () => {
  const result = createFinancialContext(fixture(), { ...options, mode: "filtered", filters: { ...filters, search: "not-present" } });
  assert.equal(result.transactions.length, 0);
  assert.deepEqual(result.scope.observedDateRange, { from: null, to: null });
  assert.equal(result.summary.postingCount, 0);
  assert.equal(result.summary.netEurMinor, 0);
  assert.equal(result.historicalAnalysis.status, "unavailable");
});

test("current text and category filters apply without deferred UI state or pagination", () => {
  const result = createFinancialContext(fixture(), { ...options, mode: "filtered", filters: { ...createDefaultFilterState(), search: "Matched", categoryPrefixes: [["Food"]] } });
  assert.deepEqual(result.transactions.map((row) => row.transactionId), ["food"]);
  assert.equal(result.scope.granularity, "month");
  assert.equal(result.exportedAt, options.exportedAt);
  assert.equal(result.semantics.currency, "EUR");
});

test("strict scope preserves active membership and input data across different filters", () => {
  const dataset = fixture();
  const cases = [
    { ...filters, search: "Matched" },
    { ...createDefaultFilterState(), accountIds: ["other"] },
    { ...createDefaultFilterState(), categoryPrefixes: [["Salary"]] },
    { ...createDefaultFilterState(), dateRange: { from: "2025-01-01" as const, to: null } },
  ];
  for (const selected of cases) {
    const before = JSON.stringify({ dataset, selected });
    const result = createFinancialContext(dataset, { ...options, mode: "filtered", filters: selected });
    assert.deepEqual(result.transactions.map((row) => row.id), applyFilters(dataset, selected).activePostings.map((row) => row.id));
    const json = JSON.stringify(result);
    for (const forbidden of ["openingBalance", "valuationBalance", "periodOpeningBalance", "periodClosingBalance", "sourcePostingCount", "definedPayeeCount", "backupSha256", "searchIndex"]) assert.ok(!json.includes(forbidden), forbidden);
    assert.equal(JSON.stringify({ dataset, selected }), before);
  }
});

test("enriched all-data export includes budgets, currencies and patterns without raw backup secrets", async () => {
  const preferences = { homeCurrency: "EUR", includeTransfers: false, monthStart: 1, weekStart: 2, unmappedTransactionsAsTransfers: false } as const;
  const bytes = await createImportDatabaseFixture();
  const canonical = await withBackupDatabase(bytes, (database) => adaptV189(database, { timeZone: "Europe/Madrid", preferences }));
  const dataset = normalizeBackupDataset(createAppDataset({
    canonical, preferences, timeZone: "Europe/Madrid", backupSha256: "a".repeat(64), databaseSha256: "b".repeat(64),
    budgetUiSettings: new Map(canonical.budgets.map((budget) => [budget.id, { aggregateNeutral: false, filter: null }])),
  }));
  const result = createFinancialContext(dataset, { ...options, mode: "all", exportedAt: "2026-09-27T12:00:00.000Z" });
  assert.equal(result.budgets.status, "available");
  assert.ok("items" in result.budgets);
  assert.equal(result.budgets.items.length, 1);
  assert.ok(JSON.stringify(result.budgets).includes('"status":"ready"'));
  assert.equal(result.patterns.status, "available");
  assert.ok("timing" in result.patterns && "valueDates" in result.patterns);
  assert.equal(result.patterns.timing.totalPostingCount, result.transactions.length);
  assert.equal(result.patterns.valueDates.totalPostingCount, result.transactions.length);
  assert.ok(result.transactions.some((row) => row.currency === "USD"));
  const json = JSON.stringify(result);
  for (const sentinel of ["PRIVATE-IBAN", "PRIVATE-BIC", "backupSha256", "databaseSha256", '"searchIndex"', '"contributions"']) assert.ok(!json.includes(sentinel), sentinel);
  const partial = createFinancialContext(dataset, { ...options, mode: "filtered", filters: { ...createDefaultFilterState(), search: "no-matching-record" } });
  assert.deepEqual(partial.accounts, []);
  assert.equal(partial.budgets.status, "unavailable");
  assert.ok(!JSON.stringify(partial).includes('"definition"'));
  const strict = createFinancialContext(dataset, { ...options, mode: "filtered", filters: createDefaultFilterState() });
  assert.equal(strict.patterns.status, "available");
  assert.ok("timing" in strict.patterns && "valueDates" in strict.patterns);
  assert.equal(strict.patterns.timing.totalPostingCount, strict.transactions.length);
  assert.equal(strict.patterns.valueDates.totalPostingCount, strict.transactions.length);
});
