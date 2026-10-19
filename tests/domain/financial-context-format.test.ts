import assert from "node:assert/strict";
import test from "node:test";
import { createFinancialContext } from "../../src/domain/analytics/financial-context.ts";
import { serializeFinancialContext } from "../../src/domain/analytics/financial-context-format.ts";
import { createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import { normalizeBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { createAppDataset } from "../../scripts/import-backup/app-dataset.ts";
import { withBackupDatabase } from "../../scripts/import-backup/database.ts";
import { createImportDatabaseFixture } from "../../scripts/import-backup/test-fixtures.ts";
import { adaptV189 } from "../../scripts/import-backup/v189/adapter.ts";

// Independent reader of the documented wire format, not the encoder's internals.
function decode(text: string) {
  const { encoding, transactions: table, ...snapshot } = JSON.parse(text);
  const transactions = table.rows.map((cells: unknown[], rowIndex: number) => {
    const row: Record<string, unknown> = Object.assign({}, table.defaults);
    table.columns.forEach((name: string, columnIndex: number) => {
      const cell = cells[columnIndex];
      row[name] = cell === null ? null
        : table.identifiers?.columns.includes(name) ? table.identifiers.values[cell as number]
          : table.dictionaries?.[name] ? table.dictionaries[name][cell as number] : cell;
    });
    for (const [name, indexes] of Object.entries(table.missing ?? {})) {
      if ((indexes as number[]).includes(rowIndex)) delete row[name];
    }
    return row;
  });
  return { ...snapshot, schemaVersion: encoding.sourceSchemaVersion, transactions };
}

function context(mode: "all" | "filtered" = "all", search = "") {
  const dataset = normalizeDataset({
    accounts: { version: 2, accounts: { bank: { label: "Bank", type: "DEFAULT" } } },
    categories: { Food: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "bank", label: "Bank", currency: "EUR", openingBalance: 100, transactions: [
      { uuid: "one", date: "2024-01-01", amount: -12.34, category: ["Food"], comment: "Visible café 🍵", sourceTransactionUuid: "one", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      { uuid: "two", date: "2024-02-01", amount: 0, category: ["Food"], comment: "OUTSIDE-FILTER", sourceTransactionUuid: "two", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
    ] }],
  });
  return createFinancialContext(dataset, { mode, filters: { ...createDefaultFilterState(), search }, granularity: "month", exportedAt: "2024-03-01T12:00:00.000Z" });
}

test("compact JSON reconstructs the entire full, filtered and empty snapshot without mutation", () => {
  for (const original of [context(), context("filtered", "Visible"), context("filtered", "no-match")]) {
    const before = JSON.stringify(original);
    const text = serializeFinancialContext(original);
    const packed = JSON.parse(text);
    assert.equal(packed.schemaVersion, 2);
    assert.equal(packed.encoding.sourceSchemaVersion, 1);
    assert.match(packed.encoding.transactions, /zero-based/);
    assert.deepEqual(decode(text), JSON.parse(before));
    assert.equal(JSON.stringify(original), before);
    assert.equal(serializeFinancialContext(original), text);
    if (original.scope.filters.search) assert.ok(!text.includes("OUTSIDE-FILTER"));
  }
});

test("columns, dictionaries and shared IDs retain exact amounts, identities, arrays and literal defaults", () => {
  const original = context();
  const base = original.transactions[0]!;
  original.transactions = Array.from({ length: 400 }, (_, index) => {
    const id = `posting-${index}-0123456789-abcdef-original-identifier`;
    return { ...base, id, transactionId: id, sourceTransactionId: id,
      amountNativeMinor: index % 2 ? -12345 : 0, amountEurMinor: index % 2 ? -11223 : 0,
      currency: index % 2 ? "USD" : "EUR", exchangeRateToEur: 0.9090909090909091,
      linked: index % 2 === 0, payee: "Same display name", accountId: `account-${index % 2}`,
      tags: index % 3 ? ["shared long tag", "café 🍵"] : [],
      categoryPath: index % 2 ? ["Food", "Groceries"] : ["Food", "Café"],
      comment: index % 2 ? "Repeated comment __proto__ $ref:0" : undefined,
      transferPeerPostingId: index % 2 ? `posting-${index - 1}-0123456789-abcdef-original-identifier` : undefined,
    };
  });
  const before = JSON.stringify(original);
  const text = serializeFinancialContext(original);
  const table = JSON.parse(text).transactions;
  assert.ok(table.identifiers.columns.includes("transactionId"));
  assert.ok(table.dictionaries.categoryPath);
  assert.ok(table.dictionaries.tags);
  assert.equal(table.defaults.payee, "Same display name");
  assert.ok(!table.columns.includes("payee"));
  assert.deepEqual(decode(text), JSON.parse(before));
  assert.ok(Buffer.byteLength(text) < Buffer.byteLength(before) * 0.5);
  assert.equal(JSON.stringify(original), before);
});

test("missing properties differ from null, zero and false, including default-valued columns", () => {
  const original = context();
  const base = original.transactions[0]!;
  original.transactions = [{ ...base, splitIndex: null, amountEurMinor: 0, linked: false }, { ...base, comment: "", splitIndex: 0, amountEurMinor: 1, linked: true }];
  Reflect.deleteProperty(original.transactions[0]!, "payee");
  Reflect.deleteProperty(original.transactions[1]!, "comment");
  Reflect.deleteProperty(original.transactions[0]!, "splitCount");
  assert.deepEqual(decode(serializeFinancialContext(original)), JSON.parse(JSON.stringify(original)));
});

test("unique text stays literal instead of growing a dictionary", () => {
  const original = context();
  original.transactions = Array.from({ length: 20 }, (_, index) => ({ ...original.transactions[0]!, comment: `Unique text ${index}` }));
  const text = serializeFinancialContext(original);
  assert.equal(JSON.parse(text).transactions.dictionaries?.comment, undefined);
  assert.deepEqual(decode(text), JSON.parse(JSON.stringify(original)));
});

test("enriched budgets, FX, transfers, splits and analyses survive full and strict-filtered serialization", async () => {
  const preferences = { homeCurrency: "EUR", includeTransfers: false, monthStart: 1, weekStart: 2, unmappedTransactionsAsTransfers: false } as const;
  const canonical = await withBackupDatabase(await createImportDatabaseFixture(), (database) => adaptV189(database, { timeZone: "Europe/Madrid", preferences }));
  const dataset = normalizeBackupDataset(createAppDataset({ canonical, preferences, timeZone: "Europe/Madrid", backupSha256: "a".repeat(64), databaseSha256: "b".repeat(64), budgetUiSettings: new Map(canonical.budgets.map((budget) => [budget.id, { aggregateNeutral: false, filter: null }])) }));
  for (const mode of ["all", "filtered"] as const) {
    const original = createFinancialContext(dataset, { mode, filters: createDefaultFilterState(), granularity: "auto", exportedAt: "2026-10-18T12:00:00.000Z" });
    const text = serializeFinancialContext(original);
    assert.deepEqual(decode(text), JSON.parse(JSON.stringify(original)));
    assert.ok(original.transactions.some((row) => row.currency === "USD"));
    for (const secret of ["PRIVATE-IBAN", "PRIVATE-BIC", "backupSha256", "databaseSha256", "searchIndex"]) assert.ok(!text.includes(secret));
  }
});
