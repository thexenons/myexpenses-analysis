import { describe, expect, it } from "vitest";

import type { BackupBudgetV1, BackupDatasetV1 } from "./backup-dataset.types.ts";
import { analyzeBudgetPeriod } from "./budgets.ts";
import { analyzeBudgetPeriodComparison } from "./budget-period-comparison.ts";
import { applyFilters, createDefaultFilterState } from "./filters.ts";
import type { AnalyticsDataset, FilterState, IsoDate, NormalizedPosting } from "./types.ts";

const preferences: BackupDatasetV1["preferences"] = {
  homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 1, weekStart: 1, includeTransfers: true,
};

function budget(overrides: Partial<BackupBudgetV1> = {}): BackupBudgetV1 {
  return {
    uuid: "budget", sourceId: 1, title: "Household", description: "", grouping: "MONTH",
    accountUuid: null, currency: "EUR", startDate: null, endDate: null,
    isDefault: true, filter: null, aggregateNeutral: false,
    allocations: [
      { categoryUuid: null, year: 2026, period: 7, amountMinor: 10_000, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false },
      { categoryUuid: "root", year: 2026, period: 7, amountMinor: 8_000, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false },
      { categoryUuid: "child", year: 2026, period: 7, amountMinor: 3_000, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false },
    ],
    ...overrides,
  };
}

function allocationsAt(year: number | null, period: number | null) {
  return budget().allocations.map((entry) => Object.assign({}, entry, { year, period }));
}

function posting(
  id: string,
  date: IsoDate,
  amountMinor: number,
  categoryPath: readonly string[],
  overrides: Partial<NormalizedPosting> = {},
): NormalizedPosting {
  return {
    id, transactionId: id, sourceTransactionId: id,
    accountId: "cash", accountLabel: "Cash", accountType: "DEFAULT",
    currency: "EUR", fractionDigits: 2, date,
    amountNativeMinor: amountMinor, amountEurMinor: amountMinor,
    exchangeRateToEur: 1, exchangeRateSource: "identity",
    categoryPath, categoryType: "EXPENSE", bucket: "expense",
    status: "RECONCILED", isVoid: false, linked: false, tags: [],
    splitIndex: null, splitCount: null, searchIndex: id,
    ...overrides,
  };
}

function coverage(date: IsoDate): NormalizedPosting {
  return posting(`coverage-${date}`, date, 0, [], { bucket: "transfer", categoryType: "TRANSFER" });
}

function dataset(
  rows: readonly NormalizedPosting[],
  selectedBudget = budget(),
  selectedPreferences = preferences,
): AnalyticsDataset {
  const dates = rows.map((row) => row.date).toSorted();
  const accounts: { id: string; label: string; currency: Uppercase<string>; type: "DEFAULT" | "DEBT" }[] = [
    { id: "cash", label: "Cash", currency: "EUR", type: "DEFAULT" as const },
    { id: "other", label: "Other", currency: "EUR", type: "DEFAULT" as const },
    { id: "debt", label: "Debt", currency: "EUR", type: "DEBT" as const },
  ];
  return {
    currency: "EUR",
    source: { accounts: { version: 2, accounts: Object.fromEntries(accounts.map((account) => [account.id, { label: account.label, type: account.type }])) }, categories: {} },
    accounts: accounts.map((account) => ({
      ...account, fractionDigits: 2, exchangeRateMode: "IDENTITY" as const,
      openingBalanceNativeMinor: 0, openingBalanceEurMinor: 0, currentBalanceNativeMinor: 0,
      historicalBalanceEurMinor: 0, valuationBalanceEurMinor: 0,
      postingCount: rows.filter((row) => row.accountId === account.id).length,
      activePostingCount: rows.filter((row) => row.accountId === account.id && !row.isVoid).length,
    })),
    postings: rows,
    minDate: dates[0] ?? null,
    maxDate: dates.at(-1) ?? null,
    backup: {
      source: { format: "myexpenses-backup", schemaVersion: 189, backupSha256: "a".repeat(64), databaseSha256: "b".repeat(64) },
      preferences: selectedPreferences,
      currencies: [
        { sourceId: 1, code: "EUR", fractionDigits: 2, label: "Euro", symbol: "€", commodityType: "FIAT" },
        { sourceId: 2, code: "GBP", fractionDigits: 2, label: "Pound", symbol: "£", commodityType: "FIAT" },
      ],
      accounts: accounts.map((account, index) => ({
        uuid: account.id, sourceId: index + 1, label: account.label, description: null,
        currency: account.currency, fractionDigits: 2, nativeType: account.type === "DEBT" ? "LIABILITY" as const : "CASH" as const,
        scope: account.type, parentUuid: null, openingNativeMinor: 0, openingHomeMinor: 0,
        exchangeRateMode: "IDENTITY" as const, exchangeRateToHome: 1,
        flags: { sourceId: 0, visible: true, excludedFromTotals: false, includedInAll: true, isAsset: true, supportsReconciliation: false },
      })),
      categories: [
        { uuid: "root", sourceId: 1, name: "Expense", type: "EXPENSE", parentUuid: null, path: ["Expense"], color: null, icon: null },
        { uuid: "child", sourceId: 2, name: "Food", type: "EXPENSE", parentUuid: "root", path: ["Expense", "Food"], color: null, icon: null },
        { uuid: "income", sourceId: 3, name: "Income", type: "INCOME", parentUuid: null, path: ["Income"], color: null, icon: null },
      ],
      payees: [], paymentMethods: [], tags: [], budgets: [selectedBudget],
    },
  };
}

function compare(
  analytics: AnalyticsDataset,
  filters: FilterState = createDefaultFilterState(),
  options: Parameters<typeof analyzeBudgetPeriodComparison>[3] = { today: "2026-10-01" },
  selectedPeriodKey = "MONTH:2026:7",
) {
  const current = analyzeBudgetPeriod(analytics, applyFilters(analytics, filters), analytics.backup!.budgets[0]!, selectedPeriodKey);
  if (current.status !== "ready") throw new Error(current.reason);
  const result = analyzeBudgetPeriodComparison(analytics, current.analysis, filters, options);
  if (result.status !== "ready") throw new Error(result.reason);
  return { current: current.analysis, comparison: result.comparison };
}

describe("budget period comparison", () => {
  it("uses the previous calendar month even without an allocation, and rolls category paths once", () => {
    const rows = [
      coverage("2026-06-01"), coverage("2026-08-31"),
      posting("july-food", "2026-07-03", -2_000, ["Expense", "Food"]),
      posting("july-refund", "2026-07-04", 500, ["Expense", "Food"]),
      posting("july-root", "2026-07-05", -700, ["Expense"]),
      posting("august-food", "2026-08-05", -3_000, ["Expense", "Food"]),
    ];
    const { current, comparison } = compare(dataset(rows), {
      ...createDefaultFilterState(), dateRange: { from: "2026-08-01", to: "2026-08-31" },
    });
    expect(current.global.consumedMinor).toBe(3_000);
    expect(comparison.references[0]).toMatchObject({
      status: "complete", range: { key: "MONTH:2026:6", startDate: "2026-07-01", endDate: "2026-07-31" },
      consumedMinor: 2_200, deltaMinor: 800, percentChange: 800 / 2_200 * 100,
    });
    expect(comparison.primaryReferenceKey).toBe("MONTH:2026:6");
    const root = comparison.categories.find((item) => item.categoryUuid === "root")!;
    const child = comparison.categories.find((item) => item.categoryUuid === "child")!;
    expect(root.references[0]).toMatchObject({ consumedMinor: 2_200, deltaMinor: 800, percentChange: 800 / 2_200 * 100 });
    expect(child.references[0]).toMatchObject({ consumedMinor: 1_500, deltaMinor: 1_500, percentChange: 100 });
    expect(root.currentConsumedMinor).toBe(3_000);
    expect(child.currentConsumedMinor).toBe(3_000);
  });

  it("uses all complete covered months, including zero activity, but not partial coverage edges", () => {
    const rows = [
      coverage("2026-01-15"), coverage("2026-05-20"),
      posting("feb", "2026-02-04", -300, ["Expense", "Food"]),
      posting("apr", "2026-04-04", -900, ["Expense", "Food"]),
    ];
    const { comparison } = compare(dataset(rows, budget({ allocations: allocationsAt(2026, 4) })),
      createDefaultFilterState(), { today: "2026-06-01" }, "MONTH:2026:4");
    expect(comparison.mean).toMatchObject({
      status: "ready", unit: "MONTH", periodCount: 3,
      firstDate: "2026-02-01", lastDate: "2026-04-30",
      consumedTotalMinor: 1_200, consumedAverageMinor: 400,
    });
    expect(comparison.mean.periods.map((period) => period.key)).toEqual(["MONTH:2026:1", "MONTH:2026:2", "MONTH:2026:3"]);
    expect(comparison.categories.find((item) => item.categoryUuid === "child")?.mean.averageMinor).toBe(400);
  });

  it("distinguishes no complete history from covered zero activity", () => {
    const partial = compare(dataset([coverage("2026-07-15"), coverage("2026-08-20")]));
    expect(partial.comparison.references[0]).toMatchObject({ status: "unavailable", consumedMinor: null });
    expect(partial.comparison.mean).toMatchObject({ status: "no-complete-history", periodCount: 0, consumedAverageMinor: null });
    const complete = compare(dataset([coverage("2026-07-01"), coverage("2026-08-31")]));
    expect(complete.comparison.references[0]).toMatchObject({ status: "complete", consumedMinor: 0 });
    expect(complete.comparison.mean).toMatchObject({ status: "ready", periodCount: 1, consumedAverageMinor: 0 });
  });

  it("excludes periods after a historical target and periods not complete before today", () => {
    const history = [coverage("2026-01-01"), coverage("2026-12-31"), posting("late", "2026-05-10", -9_000, ["Expense"])];
    const march = budget({ allocations: allocationsAt(2026, 2) });
    const past = compare(dataset(history, march), createDefaultFilterState(), { today: "2026-10-01" }, "MONTH:2026:2");
    expect(past.comparison.mean.periods.map((period) => period.key)).toEqual(["MONTH:2026:0", "MONTH:2026:1"]);
    expect(past.comparison.mean.consumedAverageMinor).toBe(0);
    const future = budget({ allocations: allocationsAt(2026, 11) });
    const later = compare(dataset(history, future), createDefaultFilterState(), { today: "2026-08-15" }, "MONTH:2026:11");
    expect(later.comparison.mean.periods.at(-1)?.key).toBe("MONTH:2026:6");
    expect(later.comparison.mean.periodCount).toBe(7);
  });

  it("respects accounting month/week starts and leap-day calendar predecessors", () => {
    const month = budget({ allocations: allocationsAt(2024, 2) });
    const monthRows = [coverage("2024-02-01"), coverage("2024-04-30")];
    const monthResult = compare(dataset(monthRows, month, { ...preferences, monthStart: 15 }), createDefaultFilterState(), { today: "2024-05-01" }, "MONTH:2024:2");
    expect(monthResult.comparison.references[0]?.range).toMatchObject({ startDate: "2024-02-15", endDate: "2024-03-14" });
    const week = budget({ grouping: "WEEK", allocations: allocationsAt(2026, 1) });
    const weekResult = compare(dataset([coverage("2025-12-28"), coverage("2026-01-31")], week, { ...preferences, weekStart: 7 }),
      createDefaultFilterState(), { today: "2026-02-01" }, "WEEK:2026:1");
    expect(weekResult.comparison.references[0]?.range).toMatchObject({ startDate: "2025-12-28", endDate: "2026-01-03" });
    const day = budget({ grouping: "DAY", allocations: allocationsAt(2024, 61) });
    const dayResult = compare(dataset([coverage("2024-02-29"), coverage("2024-03-01")], day), createDefaultFilterState(), { today: "2024-03-02" }, "DAY:2024:61");
    expect(dayResult.comparison.references[0]?.range).toMatchObject({ key: "DAY:2024:60", startDate: "2024-02-29", endDate: "2024-02-29" });
  });

  it("applies non-date filters, budget scope and native currency without clipping references by the current date filter", () => {
    const scoped = budget({ accountUuid: "cash", currency: "GBP", filter: { type: "category", categoryUuids: ["child"] } });
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("wanted", "2026-07-10", -100, ["Expense", "Food"], { currency: "GBP", amountNativeMinor: -250, tags: ["keep"] }),
      posting("wrong-account", "2026-07-11", -900, ["Expense", "Food"], { accountId: "other", tags: ["keep"] }),
      posting("wrong-category", "2026-07-12", -900, ["Expense"], { tags: ["keep"] }),
      posting("wrong-tag", "2026-07-13", -900, ["Expense", "Food"], { tags: ["skip"] }),
      posting("current", "2026-08-10", -200, ["Expense", "Food"], { currency: "GBP", amountNativeMinor: -500, tags: ["keep"] }),
    ];
    const analytics = dataset(rows, scoped);
    const adjusted = { ...analytics, accounts: analytics.accounts.map((account) => account.id === "cash" ? Object.assign({}, account, { currency: "GBP" as const }) : account),
      backup: { ...analytics.backup!, accounts: analytics.backup!.accounts.map((account) => account.uuid === "cash" ? Object.assign({}, account, { currency: "GBP" as const }) : account) } };
    const filters = { ...createDefaultFilterState(), tags: ["keep"], dateRange: { from: "2026-08-01" as const, to: "2026-08-31" as const } };
    const { current, comparison } = compare(adjusted, filters);
    expect(current.global.consumedMinor).toBe(500);
    expect(comparison.references[0]).toMatchObject({ status: "complete", consumedMinor: 250 });
    expect(comparison.currency).toBe("GBP");
    expect(comparison.categories.find((item) => item.categoryUuid === "child")?.references[0]?.consumedMinor).toBe(250);
  });

  it.each(["all", "realCashFlow", "debtsOnly"] as const)("retains targeted debt-mirror contribution signs in %s", (scope) => {
    const rows = [coverage("2026-07-01"), coverage("2026-08-31")];
    const defaultSide = posting("default-side", "2026-07-10", -500, ["Expense", "Food"], { linked: true, transferPeerPostingId: "debt-side" });
    const debtSide = posting("debt-side", "2026-07-10", 500, ["Expense", "Food"], {
      accountId: "debt", accountLabel: "Debt", accountType: "DEBT", linked: true, transferPeerPostingId: "default-side",
    });
    const analytics = dataset([...rows, defaultSide, debtSide, posting("direct-debt", "2026-07-11", -200, ["Expense"], { accountId: "debt", accountLabel: "Debt", accountType: "DEBT" })]);
    const { comparison } = compare(analytics, { ...createDefaultFilterState(), scope });
    const expected = scope === "all" ? 200 : scope === "realCashFlow" ? 500 : 700;
    expect(comparison.references[0]?.consumedMinor).toBe(expected);
  });

  it("keeps scoped income separate from consumption and excludes income-shaped expense mirrors", () => {
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("july-income", "2026-07-04", 1_000, ["Income"], { bucket: "income", categoryType: "INCOME" }),
      posting("august-income", "2026-08-04", 2_000, ["Income"], { bucket: "income", categoryType: "INCOME" }),
      posting("expense-mirror", "2026-07-05", 500, ["Expense", "Food"], { bucket: "income", categoryType: "EXPENSE" }),
      posting("july-expense", "2026-07-06", -300, ["Expense", "Food"]),
    ];
    const { comparison } = compare(dataset(rows));
    expect(comparison.income).toMatchObject({ scope: "income-category-postings", currentMinor: 2_000 });
    expect(comparison.income.references[0]).toMatchObject({ amountMinor: 1_000, deltaMinor: 1_000, percentChange: 100 });
    expect(comparison.references[0]).toMatchObject({ consumedMinor: 300, incomeMinor: 1_000 });
    expect(comparison.mean).toMatchObject({ incomeTotalMinor: 1_000, incomeAverageMinor: 1_000 });
  });

  it("keeps empty-status filtering inclusive but excludes VOID and follows the selected value-date basis", () => {
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("moved", "2026-08-02", -300, ["Expense", "Food"], { valueDate: "2026-07-12", status: "CLEARED" }),
      posting("void", "2026-07-10", -900, ["Expense", "Food"], { status: "VOID", isVoid: true }),
      posting("neutral", "2026-07-13", -100, ["Expense"], { bucket: "transfer", categoryType: "NEUTRAL" }),
    ];
    const filters = { ...createDefaultFilterState(), dateBasis: "value" as const, statuses: [] as const };
    const { comparison } = compare(dataset(rows, budget({ aggregateNeutral: true })), filters);
    expect(comparison.references[0]).toMatchObject({ status: "complete", consumedMinor: 400 });
    expect(comparison.categories.find((item) => item.categoryUuid === "child")?.references[0]?.consumedMinor).toBe(300);
    const withoutNeutral = compare(dataset(rows), filters);
    expect(withoutNeutral.comparison.references[0]?.consumedMinor).toBe(300);
  });

  it("uses complete civil years as the mean unit", () => {
    const annual = budget({ grouping: "YEAR", allocations: allocationsAt(2026, 0) });
    const { comparison } = compare(dataset([
      coverage("2024-01-01"), coverage("2026-12-31"),
      posting("past", "2024-04-12", -600, ["Expense", "Food"]),
    ], annual), createDefaultFilterState(), { today: "2027-01-01" }, "YEAR:2026:0");
    expect(comparison.references[0]?.range).toMatchObject({ key: "YEAR:2025:0", startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(comparison.mean).toMatchObject({ unit: "YEAR", periodCount: 2, consumedAverageMinor: 300 });
  });

  it("accepts multiple complete references, one primary, and null percentages for zero or missing baselines", () => {
    const rows = [coverage("2026-06-01"), coverage("2026-08-31"), posting("june", "2026-06-04", 200, ["Expense", "Food"]), posting("aug", "2026-08-04", -100, ["Expense", "Food"])];
    const references = [
      { key: "june", label: "June", startDate: "2026-06-01" as const, endDate: "2026-06-30" as const },
      { key: "july", label: "July", startDate: "2026-07-01" as const, endDate: "2026-07-31" as const },
      { key: "future", label: "Future", startDate: "2026-09-01" as const, endDate: "2026-09-30" as const },
    ];
    const { comparison } = compare(dataset(rows), createDefaultFilterState(), { today: "2026-09-01", references, primaryReferenceKey: "july" });
    expect(comparison.primaryReferenceKey).toBe("july");
    expect(comparison.references.map((reference) => [reference.status, reference.consumedMinor])).toEqual([
      ["complete", -200], ["complete", 0], ["unavailable", null],
    ]);
    expect(comparison.references.map((reference) => reference.percentChange)).toEqual([150, null, null]);
    expect(comparison.categories.find((item) => item.categoryUuid === "child")?.references.map((reference) => reference.percentChange))
      .toEqual([150, null, null]);
  });

  it("requires explicit ranges for NONE and reports that its average has no safe unit", () => {
    const custom = budget({ grouping: "NONE", startDate: "2026-08-01", endDate: "2026-08-31",
      allocations: allocationsAt(null, null) });
    const rows = [coverage("2026-07-01"), coverage("2026-08-31"), posting("july", "2026-07-05", -500, ["Expense", "Food"])];
    const analytics = dataset(rows, custom);
    const without = compare(analytics, createDefaultFilterState(), { today: "2026-10-01" }, "NONE:all:all");
    expect(without.comparison.references).toEqual([]);
    expect(without.comparison.mean).toMatchObject({ status: "unsupported-grouping", unit: null, consumedAverageMinor: null });
    const withRange = compare(analytics, createDefaultFilterState(), { today: "2026-10-01", references: [
      { key: "july", label: "July", startDate: "2026-07-01", endDate: "2026-07-31" },
    ] }, "NONE:all:all");
    expect(withRange.comparison.references[0]).toMatchObject({ status: "complete", consumedMinor: 500 });
  });

  it.each([1, -1] as const)("rejects unsafe %s-direction integer comparison deltas", (direction) => {
    const large = Number.MAX_SAFE_INTEGER - 10_000;
    const currentConsumed = direction * large;
    const referenceConsumed = -direction * 20_000;
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("reference", "2026-07-12", -referenceConsumed, ["Expense", "Food"]),
      posting("current", "2026-08-12", -currentConsumed, ["Expense", "Food"]),
    ];
    expect(() => compare(dataset(rows))).toThrow("Budget comparison exceeds safe minor units");
  });

  it.each([1, -1] as const)("preserves safe %s-direction integer boundary deltas", (direction) => {
    const large = Number.MAX_SAFE_INTEGER - 10_000;
    const currentConsumed = direction === 1 ? large : -10_000;
    const referenceConsumed = direction === 1 ? -10_000 : large;
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("reference", "2026-07-12", -referenceConsumed, ["Expense", "Food"]),
      posting("current", "2026-08-12", -currentConsumed, ["Expense", "Food"]),
    ];
    const { comparison } = compare(dataset(rows));
    expect(comparison.references[0]?.deltaMinor).toBe(direction * Number.MAX_SAFE_INTEGER);
    expect(comparison.categories.find((item) => item.categoryUuid === "child")?.references[0]?.deltaMinor)
      .toBe(direction * Number.MAX_SAFE_INTEGER);
  });

  it("preserves fractional historical means and their expense and income deltas", () => {
    const rows = [
      coverage("2026-06-01"), coverage("2026-08-31"),
      posting("july-expense", "2026-07-12", -1, ["Expense", "Food"]),
      posting("august-expense", "2026-08-12", -2, ["Expense", "Food"]),
      posting("july-income", "2026-07-12", 3, ["Income"], { bucket: "income", categoryType: "INCOME" }),
      posting("august-income", "2026-08-12", 2, ["Income"], { bucket: "income", categoryType: "INCOME" }),
    ];
    const { comparison } = compare(dataset(rows));
    expect(comparison.mean).toMatchObject({ periodCount: 2, consumedAverageMinor: 0.5, incomeAverageMinor: 1.5 });
    expect(comparison.categories.find((item) => item.categoryUuid === "child")?.mean)
      .toMatchObject({ averageMinor: 0.5, deltaMinor: 1.5, percentChange: 300 });
    expect(comparison.income.mean).toMatchObject({ averageMinor: 1.5, deltaMinor: 0.5, percentChange: 0.5 / 1.5 * 100 });
  });

  it("keeps full current totals while comparing only elapsed days and excluding future postings", () => {
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("july", "2026-07-10", -200, ["Expense", "Food"]),
      posting("august", "2026-08-10", -100, ["Expense", "Food"]),
      posting("future", "2026-08-25", -900, ["Expense", "Food"]),
      posting("july-income", "2026-07-11", 400, ["Income"], { bucket: "income", categoryType: "INCOME" }),
      posting("august-income", "2026-08-11", 300, ["Income"], { bucket: "income", categoryType: "INCOME" }),
    ];
    const { current, comparison } = compare(dataset(rows), createDefaultFilterState(), { today: "2026-08-15" });
    expect(current.global.consumedMinor).toBe(1_000);
    expect(comparison.references[0]).toMatchObject({ consumedMinor: 200 });
    expect(comparison.elapsed?.references[0]).toMatchObject({
      status: "complete",
      currentRange: { from: "2026-08-01", to: "2026-08-15" },
      referenceRange: { from: "2026-07-01", to: "2026-07-15" },
      currentConsumedMinor: 100,
      referenceConsumedMinor: 200,
      deltaMinor: -100,
      currentIncomeMinor: 300,
      referenceIncomeMinor: 400,
    });
    expect(comparison.elapsed?.references[0]?.categories.find((item) => item.categoryUuid === "child"))
      .toMatchObject({ currentConsumedMinor: 100, referenceConsumedMinor: 200, deltaMinor: -100 });
  });

  it("clamps a shorter reference month to the same number of current days", () => {
    const march = budget({ allocations: allocationsAt(2026, 2) });
    const rows = [
      coverage("2026-02-01"), coverage("2026-03-31"),
      posting("february", "2026-02-28", -20, ["Expense", "Food"]),
      posting("march-28", "2026-03-28", -50, ["Expense", "Food"]),
      posting("march-29", "2026-03-29", -100, ["Expense", "Food"]),
    ];
    const { comparison } = compare(dataset(rows, march), createDefaultFilterState(), { today: "2026-03-30" }, "MONTH:2026:2");
    expect(comparison.elapsed?.references[0]).toMatchObject({
      currentRange: { from: "2026-03-01", to: "2026-03-28" },
      referenceRange: { from: "2026-02-01", to: "2026-02-28" },
      currentConsumedMinor: 50, referenceConsumedMinor: 20,
    });
  });

  it("maps a selected current-date cut to matching reference-day offsets", () => {
    const rows = [
      coverage("2026-07-01"), coverage("2026-08-31"),
      posting("outside-reference-cut", "2026-07-01", -500, ["Expense", "Food"]),
      posting("within-reference-cut", "2026-07-11", -300, ["Expense", "Food"]),
      posting("within-current-cut", "2026-08-11", -100, ["Expense", "Food"]),
    ];
    const filters = { ...createDefaultFilterState(), dateRange: { from: "2026-08-10" as const, to: "2026-08-12" as const } };
    const { comparison } = compare(dataset(rows), filters, { today: "2026-08-15" });
    expect(comparison.elapsed?.references[0]).toMatchObject({
      currentRange: { from: "2026-08-10", to: "2026-08-12" },
      referenceRange: { from: "2026-07-10", to: "2026-07-12" },
      currentConsumedMinor: 100, referenceConsumedMinor: 300,
    });
  });
});
