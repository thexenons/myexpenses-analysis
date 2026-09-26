import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Database, SqlValue } from "sql.js";

import { readBackupArchive } from "../../scripts/import-backup/archive.ts";
import { withBackupDatabase } from "../../scripts/import-backup/database.ts";
import { parseBackupPreferences } from "../../scripts/import-backup/preferences.ts";
import { aggregateCategoryBreakdown, aggregateKpis } from "../../src/domain/analytics/aggregations.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeBackupDataset, parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import type { BackupDatasetV1 } from "../../src/domain/analytics/backup-dataset.types.ts";
import type { AnalyticsScope, KpiSummary } from "../../src/domain/analytics/types.ts";

// This optional private-data test records only counts. SQL computes the oracle
// directly from base tables; it never calls the importer adapter or its mapper.
const BACKUP_PATH = fileURLToPath(new URL("../../data/myexpenses-backup-20260926-070855.zip", import.meta.url));
const DEFAULT_DATASET_PATH = fileURLToPath(new URL("../../data/app-dataset.json", import.meta.url));

const ORACLE_SQL = `
WITH RECURSIVE category_tree(id, type, path) AS (
  SELECT _id, type, json_array(label)
  FROM categories WHERE parent_id IS NULL AND _id != 0
  UNION ALL
  SELECT child._id, parent.type, json_insert(parent.path, '$[#]', child.label)
  FROM categories child JOIN category_tree parent ON child.parent_id = parent.id
), account_base AS (
  SELECT a._id AS id, a.uuid, a.currency, a.type,
    a.dynamic, COALESCE(a.opening_balance, 0) AS opening_native,
    -- App policy deliberately ignores MyExpenses' exclude_from_totals flag.
    a.parent_id IS NULL AS included,
    CASE WHEN a.currency = 'EUR' THEN 1 ELSE r.exchange_rate END AS rate,
    CASE WHEN a.currency = 'EUR' THEN 1
      WHEN a.dynamic = 0 THEN r.exchange_rate
      ELSE COALESCE((SELECT value FROM prices
        WHERE commodity = a.currency AND currency = 'EUR'
        ORDER BY date DESC,
          CASE source WHEN 'user' THEN 1 WHEN 'calculation' THEN 3 ELSE 2 END,
          source DESC LIMIT 1), r.exchange_rate)
    END AS valuation_rate
  FROM accounts a
  LEFT JOIN account_exchangerates r ON r.account_id = a._id
    AND r.currency_self = a.currency AND r.currency_other = 'EUR'
), leaves AS (
  SELECT t._id AS id, t.account_id, a.uuid AS account_uuid, t.uuid,
    t.amount AS native_amount, t.date, t.cr_status,
    CASE WHEN parent.cat_id = 0 THEN parent.value_date ELSE t.value_date END AS value_date,
    COALESCE(cat.type, :uncategorized_type) AS category_type,
    COALESCE(cat.path, '[]') AS category_path,
    CASE
      WHEN a.currency = 'EUR' THEN t.amount
      WHEN a.dynamic = 1 AND t.parent_id IS NULL AND own_eq.equivalent_amount IS NOT NULL
        THEN own_eq.equivalent_amount
      WHEN a.dynamic = 1 AND t.parent_id IS NOT NULL
        AND parent.amount != 0 AND parent_eq.equivalent_amount IS NOT NULL
        THEN CAST(round(1.0 * parent_eq.equivalent_amount / parent.amount * t.amount) AS INTEGER)
      ELSE CAST(round(t.amount * COALESCE(a.rate, 0)) AS INTEGER)
    END AS home_amount
  FROM transactions t
  JOIN account_base a ON a.id = t.account_id
  LEFT JOIN transactions parent ON parent._id = t.parent_id
  LEFT JOIN category_tree cat ON cat.id = t.cat_id
  LEFT JOIN equivalent_amounts own_eq ON own_eq.transaction_id = t._id AND own_eq.currency = 'EUR'
  LEFT JOIN equivalent_amounts parent_eq ON parent_eq.transaction_id = parent._id AND parent_eq.currency = 'EUR'
  WHERE t.status NOT IN (2, 4) AND t.cat_id IS NOT 0
), classified AS (
  SELECT *, CASE category_type
    WHEN 0 THEN 'transfer' WHEN 1 THEN 'expense' WHEN 2 THEN 'income'
    ELSE CASE WHEN native_amount > 0 THEN 'income' ELSE 'expense' END
  END AS bucket FROM leaves
), balances AS (
  SELECT a.*,
    CAST(round(a.opening_native * COALESCE(a.rate, 0)) AS INTEGER) AS opening_home,
    a.opening_native + COALESCE(SUM(CASE WHEN p.cr_status != 'VOID' THEN p.native_amount ELSE 0 END), 0) AS closing_native,
    CAST(round(a.opening_native * COALESCE(a.rate, 0)) AS INTEGER)
      + COALESCE(SUM(CASE WHEN p.cr_status != 'VOID' THEN p.home_amount ELSE 0 END), 0) AS closing_home
  FROM account_base a LEFT JOIN classified p ON p.account_id = a.id
  GROUP BY a.id
)
`;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function optionalBytes(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
  }
  // Keep private paths and file contents out of nested test-runner errors.
  throw new Error("Local parity input could not be read");
}

function query(database: Database, sql: string, uncategorizedType: number): Record<string, SqlValue>[] {
  const statement = database.prepare(`${ORACLE_SQL}${sql}`, { ":uncategorized_type": uncategorizedType });
  try {
    const result: Record<string, SqlValue>[] = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally {
    statement.free();
  }
}

function civilTimestamp(epochSeconds: number, formatter: Intl.DateTimeFormat): { date: string; time: string } {
  const parts = new Map(formatter.formatToParts(new Date(epochSeconds * 1_000)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}`,
  };
}

test("latest local backup agrees with independent SQLite financial queries", async (context) => {
  const datasetPath = process.env.MYEXPENSES_PARITY_DATASET ?? DEFAULT_DATASET_PATH;
  const [backupBytes, datasetBytes] = await Promise.all([optionalBytes(BACKUP_PATH), optionalBytes(datasetPath)]);
  if (backupBytes === null || datasetBytes === null) {
    context.skip("The optional local backup and dataset are not both available");
    return;
  }

  let source: BackupDatasetV1;
  try {
    source = parseBackupDataset(JSON.parse(datasetBytes.toString("utf8")) as unknown);
  } catch {
    // Validation messages may contain financial identifiers; never print them.
    throw new Error("The local parity dataset failed boundary validation");
  }
  const originalHash = sha256(backupBytes);
  if (source.source.backupSha256 !== originalHash && process.env.MYEXPENSES_PARITY_DATASET === undefined) {
    context.skip("The current dataset belongs to a different backup");
    return;
  }
  let checks = 0;
  const check = (condition: boolean, label: string): void => {
    checks += 1;
    if (!condition) throw new Error(`Local backup parity failed: ${label}`);
  };
  check(source.source.backupSha256 === originalHash, "backup provenance");
  const archive = await readBackupArchive(BACKUP_PATH);
  check(source.source.databaseSha256 === sha256(archive.database), "database provenance");
  const preferences = parseBackupPreferences(archive.preferencesXml);
  check((preferences.homeCurrency ?? "EUR") === "EUR", "home currency");
  const uncategorizedType = preferences.unmappedTransactionAsTransfer === true ? 0 : 3;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: source.preferences.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let analytics;
  try {
    analytics = normalizeBackupDataset(source);
  } catch {
    throw new Error("The local parity dataset failed normalization");
  }

  await withBackupDatabase(archive.database, (database, metadata) => {
    check(source.source.schemaVersion === metadata.schemaVersion, "schema version");
    const expectedPostings = query(database, "SELECT * FROM classified ORDER BY id", uncategorizedType);
    const importedPostings = new Map(source.postings.map((posting) => [posting.sourceId, posting]));
    const normalizedPostings = new Map(analytics.postings.map((posting) => [posting.sourceRowId, posting]));
    check(importedPostings.size === expectedPostings.length, "canonical leaf count");
    check(normalizedPostings.size === expectedPostings.length, "normalized leaf count");
    const categoryTypes = ["TRANSFER", "EXPENSE", "INCOME", "NEUTRAL"];
    for (const row of expectedPostings) {
      const posting = importedPostings.get(Number(row.id));
      const normalized = normalizedPostings.get(Number(row.id));
      check(posting !== undefined && normalized !== undefined, "leaf identity");
      if (posting === undefined || normalized === undefined) continue;
      check(posting.accountUuid === row.account_uuid && normalized.accountId === row.account_uuid, "posting account");
      check(posting.transactionUuid === row.uuid, "transaction provenance");
      check(posting.amountNativeMinor === row.native_amount && normalized.amountNativeMinor === row.native_amount, "native amount");
      check(posting.amountHomeMinor === row.home_amount && normalized.amountEurMinor === row.home_amount, "EUR amount");
      check(posting.status === row.cr_status && normalized.status === row.cr_status, "reconciliation status");
      check(posting.isVoid === (row.cr_status === "VOID"), "VOID exclusion");
      check(posting.categoryType === categoryTypes[Number(row.category_type)], "root category type");
      check(JSON.stringify(posting.categoryPath) === row.category_path, "category ancestry");
      check(posting.bucket === row.bucket && normalized.bucket === row.bucket, "financial bucket");
      const operation = civilTimestamp(Number(row.date), formatter);
      check(posting.epochSeconds === row.date, "operation instant");
      check(posting.localDate === operation.date && normalized.date === operation.date, "operation date");
      check(posting.localTime === operation.time && normalized.localTime === operation.time, "operation time");
      const value = row.value_date === 0 ? null : civilTimestamp(Number(row.value_date), formatter);
      check(posting.valueEpochSeconds === (row.value_date === 0 ? null : row.value_date), "effective value instant");
      check(posting.valueLocalDate === (value?.date ?? null) && (normalized.valueDate ?? null) === (value?.date ?? null), "effective value date");
      check(posting.valueLocalTime === (value?.time ?? null), "effective value time");
    }

    const expectedAccounts = query(database, "SELECT *, CAST(round(closing_native * COALESCE(valuation_rate, 0)) AS INTEGER) AS valuation FROM balances", uncategorizedType);
    const accounts = new Map(analytics.accounts.map((account) => [account.sourceRowId, account]));
    check(accounts.size === expectedAccounts.length, "account count");
    for (const row of expectedAccounts) {
      const account = accounts.get(Number(row.id));
      check(account !== undefined, "account identity");
      if (account === undefined) continue;
      check(account.id === row.uuid, "account provenance");
      check(account.openingBalanceNativeMinor === row.opening_native, "native opening");
      check(account.openingBalanceEurMinor === row.opening_home, "EUR opening");
      check(account.currentBalanceNativeMinor === row.closing_native, "native closing");
      check(account.historicalBalanceEurMinor === row.closing_home, "historical closing");
      check(account.valuationBalanceEurMinor === row.valuation, "account valuation");
      check(account.includedInAll === (row.included === 1), "account inclusion");
      check(account.type === (row.type === 5 ? "DEBT" : "DEFAULT"), "account scope");
    }

    const summaries = new Map<AnalyticsScope, KpiSummary>();
    const scopes = { all: "1", realCashFlow: "a.type != 5", debtsOnly: "a.type = 5" } as const;
    for (const [scope, predicate] of Object.entries(scopes) as [AnalyticsScope, string][]) {
      const summary = aggregateKpis(applyFilters(analytics, { ...createDefaultFilterState(), scope }));
      summaries.set(scope, summary);
      const [movements] = query(database, `
        SELECT COUNT(*) AS count, COALESCE(SUM(p.home_amount), 0) AS net,
          COALESCE(SUM(CASE WHEN bucket = 'expense' THEN home_amount ELSE 0 END), 0) AS expenses,
          COALESCE(SUM(CASE WHEN bucket = 'income' THEN home_amount ELSE 0 END), 0) AS incomes,
          COALESCE(SUM(CASE WHEN bucket = 'transfer' THEN home_amount ELSE 0 END), 0) AS transfers
        FROM classified p JOIN account_base a ON a.id = p.account_id
        WHERE a.included = 1 AND p.cr_status != 'VOID' AND ${predicate}`, uncategorizedType);
      const [balances] = query(database, `
        SELECT COUNT(*) AS count, COALESCE(SUM(opening_home), 0) AS opening,
          COALESCE(SUM(closing_home), 0) AS closing
        FROM balances a WHERE a.included = 1 AND ${predicate}`, uncategorizedType);
      check(summary.postingCount === movements?.count, "scope posting count");
      check(summary.netEurMinor === movements?.net, "scope net flow");
      check(summary.expensesEurMinor === movements?.expenses, "scope expense flow");
      check(summary.incomesEurMinor === movements?.incomes, "scope income flow");
      check(summary.transfersEurMinor === movements?.transfers, "scope transfer flow");
      check(summary.accountCount === balances?.count, "scope account count");
      check(summary.periodOpeningBalanceEurMinor === balances?.opening, "scope opening");
      check(summary.periodClosingBalanceEurMinor === balances?.closing, "scope closing");
    }
    for (const key of ["postingCount", "accountCount", "netEurMinor", "expensesEurMinor", "incomesEurMinor", "transfersEurMinor", "periodOpeningBalanceEurMinor", "periodClosingBalanceEurMinor"] as const) {
      check(summaries.get("all")![key] === summaries.get("realCashFlow")![key] + summaries.get("debtsOnly")![key], "ALL = real cash + debt");
    }
    const breakdown = aggregateCategoryBreakdown(applyFilters(analytics, createDefaultFilterState()));
    check(breakdown.reduce((total, category) => total + category.summary.netEurMinor, 0) === summaries.get("all")!.netEurMinor, "complete category partition");
  });
  check(sha256(await readFile(BACKUP_PATH)) === originalHash, "backup remained unchanged");
  context.diagnostic(`${checks} private parity checks passed without printing financial values`);
});
