import { describe, expect, it } from "vitest";

import type { BackupBudgetV1, BackupDatasetV1 } from "./backup-dataset.types.ts";
import { analyzeAnnualSavingsProjection } from "./annual-projection.ts";
import { analyzeBudgetPeriod } from "./budgets.ts";
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
      { categoryUuid: null, year: 2026, period: 0, amountMinor: 500, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false },
    ],
    ...overrides,
  };
}

function posting(id: string, date: IsoDate, amount: number, overrides: Partial<NormalizedPosting> = {}): NormalizedPosting {
  return {
    id, transactionId: id, sourceTransactionId: id, accountId: "cash", accountLabel: "Cash", accountType: "DEFAULT",
    currency: "EUR", fractionDigits: 2, date, amountNativeMinor: amount, amountEurMinor: amount,
    exchangeRateToEur: 1, exchangeRateSource: "identity", categoryPath: ["Expense"], categoryType: "EXPENSE", bucket: "expense",
    status: "RECONCILED", isVoid: false, linked: false, tags: [], splitIndex: null, splitCount: null, ...overrides,
  };
}

function coverage(date: IsoDate): NormalizedPosting {
  return posting(`coverage-${date}`, date, 0, { bucket: "transfer", categoryType: "TRANSFER" });
}

function income(id: string, date: IsoDate, amount: number, overrides: Partial<NormalizedPosting> = {}): NormalizedPosting {
  return posting(id, date, amount, { bucket: "income", categoryType: "INCOME", categoryPath: ["Income"], ...overrides });
}

function dataset(rows: readonly NormalizedPosting[], selectedBudget = budget(), selectedPreferences = preferences): AnalyticsDataset {
  const dates = rows.map((row) => row.date).toSorted();
  const accounts = [
    { id: "cash", label: "Cash", currency: "EUR" as const, type: "DEFAULT" as const },
    { id: "other", label: "Other", currency: "EUR" as const, type: "DEFAULT" as const },
    { id: "debt", label: "Debt", currency: "EUR" as const, type: "DEBT" as const },
  ];
  return {
    currency: "EUR",
    source: { accounts: { version: 2, accounts: Object.fromEntries(accounts.map((account) => [account.id, { label: account.label, type: account.type }])) }, categories: {} },
    accounts: accounts.map((account) => ({
      ...account, fractionDigits: 2, exchangeRateMode: "IDENTITY" as const,
      openingBalanceNativeMinor: 0, openingBalanceEurMinor: 0, currentBalanceNativeMinor: 0,
      historicalBalanceEurMinor: 0, valuationBalanceEurMinor: 0, postingCount: 0, activePostingCount: 0,
    })),
    postings: rows, minDate: dates[0] ?? null, maxDate: dates.at(-1) ?? null,
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
        { uuid: "category", sourceId: 1, name: "Expense", type: "EXPENSE", parentUuid: null, path: ["Expense"], color: null, icon: null },
      ], payees: [], paymentMethods: [], tags: [], budgets: [selectedBudget],
    },
  };
}

function project(
  analytics: AnalyticsDataset,
  filters: FilterState = createDefaultFilterState(),
  today: IsoDate = "2026-03-15",
  selectedPeriodKey = "MONTH:2026:0",
) {
  const current = analyzeBudgetPeriod(analytics, applyFilters(analytics, filters), analytics.backup!.budgets[0]!, selectedPeriodKey);
  if (current.status !== "ready") throw new Error(current.reason);
  return analyzeAnnualSavingsProjection(analytics, current.analysis, filters, { today });
}

describe("annual savings projection", () => {
  it("uses covered closed months as actual flow, same-year income mean for estimates, and cumulative signed totals", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-02-28"),
      income("jan-income", "2026-01-10", 1_000), posting("jan-cost", "2026-01-11", -200),
      income("feb-income", "2026-02-10", 2_000), posting("feb-cost", "2026-02-11", -2_500),
      income("march-received", "2026-03-10", 500),
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income).toMatchObject({ basis: "same-year-complete-month-mean", completeMonthCount: 2, totalMinor: 3_000, expectedMonthlyMinor: 1_500 });
    expect(result.points).toHaveLength(12);
    expect(result.points.slice(0, 4)).toMatchObject([
      { key: "2026-01", kind: "actual", incomeMinor: 1_000, monthlyContributionEurMinor: 800, cumulativeEurMinor: 800 },
      { key: "2026-02", kind: "actual", incomeMinor: 2_000, monthlyContributionEurMinor: -500, cumulativeEurMinor: 300 },
      { key: "2026-03", kind: "estimated", incomeMinor: 1_500, observedIncomeEurMinor: 500, budgetMinor: 500, monthlyContributionEurMinor: 1_000, cumulativeEurMinor: 1_300 },
      { key: "2026-04", kind: "estimated", incomeMinor: 1_500, observedIncomeEurMinor: 0, monthlyContributionEurMinor: 1_000, cumulativeEurMinor: 2_300 },
    ]);
    expect(result.points.at(-1)?.cumulativeEurMinor).toBe(10_300);
  });

  it("does not add received income to the expected total and raises the estimate to receipts when higher", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"), income("jan", "2026-01-05", 900),
      income("mar", "2026-03-10", 1_200),
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.points[2]).toMatchObject({ kind: "estimated", observedIncomeEurMinor: 1_200, incomeMinor: 1_200, monthlyContributionEurMinor: 700 });
    // February is fully covered despite having no activity, so the baseline is (900 + 0) / 2.
    expect(result.income.completeMonthCount).toBe(2);
    expect(result.points[3]).toMatchObject({ kind: "estimated", incomeMinor: 450, monthlyContributionEurMinor: -50 });
  });

  it("counts income received today while keeping the current month estimated", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"), income("jan", "2026-01-05", 900),
      income("today", "2026-02-15", 3_000),
    ]), createDefaultFilterState(), "2026-02-15");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income.expectedMonthlyMinor).toBe(900);
    expect(result.points[1]).toMatchObject({ kind: "estimated", observedIncomeEurMinor: 3_000,
      incomeMinor: 3_000, monthlyContributionEurMinor: 2_500 });
    expect(result.coverage.to).toBe("2026-02-15");
  });

  it("lets a posting today complete coverage of the preceding closed month", () => {
    const result = project(dataset([
      coverage("2026-01-01"), income("february", "2026-02-01", 800),
    ]), createDefaultFilterState(), "2026-02-01");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income).toMatchObject({ completeMonthKeys: ["2026-01"], expectedMonthlyMinor: 0 });
    expect(result.points[0]).toMatchObject({ kind: "actual", monthlyContributionEurMinor: 0 });
    expect(result.points[1]).toMatchObject({ kind: "estimated", incomeMinor: 800, monthlyContributionEurMinor: 300 });
  });

  it("uses selected value dates to include today and exclude tomorrow", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"), income("jan", "2026-01-05", 900),
      income("today-value", "2026-02-20", 3_000, { valueDate: "2026-02-15" }),
      income("future-value", "2026-02-05", 8_000, { valueDate: "2026-02-16" }),
    ]), { ...createDefaultFilterState(), dateBasis: "value" }, "2026-02-15");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.dateBasis).toBe("value");
    expect(result.points[1]).toMatchObject({ kind: "estimated", observedIncomeEurMinor: 3_000,
      incomeMinor: 3_000, monthlyContributionEurMinor: 2_500 });
    expect(result.coverage.to).toBe("2026-02-15");
  });

  it("preserves a signed negative income baseline when a future month has no receipts", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"), income("reversal", "2026-01-05", -100),
    ]), createDefaultFilterState(), "2026-02-15");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income.expectedMonthlyMinor).toBe(-100);
    expect(result.points[1]).toMatchObject({ kind: "estimated", observedIncomeEurMinor: 0,
      incomeMinor: -100, monthlyContributionEurMinor: -600 });
  });

  it("refuses cumulative minor-unit overflow rather than reporting an unsafe result", () => {
    expect(() => project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"), income("jan", "2026-01-05", Number.MAX_SAFE_INTEGER),
    ]), createDefaultFilterState(), "2026-02-15")).toThrow(/safe EUR minor units/);
  });

  it("resolves each monthly global allocation by its month label, without category double counting", () => {
    const monthly = budget({ allocations: [
      { categoryUuid: null, year: 2026, period: 0, amountMinor: 500, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false },
      { categoryUuid: null, year: 2026, period: 1, amountMinor: 700, rolloverPreviousMinor: 25, rolloverNextMinor: 0, oneTime: false },
      { categoryUuid: "category", year: 2026, period: 1, amountMinor: 9_000, rolloverPreviousMinor: 1_000, rolloverNextMinor: 0, oneTime: false },
    ] });
    const result = project(dataset([coverage("2026-01-01"), coverage("2026-01-31"), income("jan", "2026-01-10", 1_000)], monthly));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.budget).toMatchObject({ grouping: "MONTH", distribution: "per-calendar-month-label" });
    expect(result.points.slice(0, 3).map((point) => point.budgetMinor)).toEqual([500, 725, 700]);
  });

  it("evenly distributes an annual budget with exact annual minor-unit sum", () => {
    const annual = budget({ grouping: "YEAR", allocations: [
      { categoryUuid: null, year: 2026, period: 0, amountMinor: 1_201, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false },
    ] });
    const result = project(dataset([coverage("2026-01-01"), coverage("2026-01-31"), income("jan", "2026-01-10", 1_000)], annual), createDefaultFilterState(), "2026-03-15", "YEAR:2026:0");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.budget).toMatchObject({ grouping: "YEAR", distribution: "even-calendar-months", annualBudgetMinor: 1_201 });
    expect(result.points.map((point) => point.budgetMinor)).toEqual([101, ...Array<number>(11).fill(100)]);
    expect(result.points.reduce((sum, point) => sum + point.budgetMinor, 0)).toBe(1_201);
  });

  it("uses actual-only values for a fully covered historical year without an income baseline", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-12-31"), posting("expense", "2026-02-02", -600),
    ]), createDefaultFilterState(), "2027-01-01");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.points.every((point) => point.kind === "actual")).toBe(true);
    expect(result.points.at(-1)?.cumulativeEurMinor).toBe(-600);
    expect(result.income.expectedMonthlyMinor).toBeNull();
  });

  it("does not use future-dated rows as coverage or baseline and refuses estimation without complete history", () => {
    const result = project(dataset([
      coverage("2026-01-15"), income("future", "2026-10-01", 90_000),
    ]));
    expect(result).toEqual({ status: "unavailable", reason: "no-complete-months" });
  });

  it("excludes partial coverage edges but counts a complete zero-income month in the baseline", () => {
    const result = project(dataset([
      coverage("2026-01-15"), coverage("2026-03-10"), income("jan", "2026-01-20", 5_000),
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income).toMatchObject({ completeMonthKeys: ["2026-02"], totalMinor: 0, expectedMonthlyMinor: 0 });
    expect(result.points[0]).toMatchObject({ kind: "estimated", incomeMinor: 5_000, monthlyContributionEurMinor: 4_500 });
    expect(result.points[1]).toMatchObject({ kind: "actual", monthlyContributionEurMinor: 0 });
    expect(result.points[2]).toMatchObject({ kind: "estimated", incomeMinor: 0, monthlyContributionEurMinor: -500 });
  });

  it("uses the full selected budget year despite a narrower selected date window", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-02-28"),
      posting("january", "2026-01-12", -50), income("february", "2026-02-12", 100),
    ]), { ...createDefaultFilterState(), dateRange: { from: "2026-02-01", to: "2026-02-28" } });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.dateScope).toBe("full-budget-calendar-year");
    expect(result.points[0]?.monthlyContributionEurMinor).toBe(-50);
    expect(result.points[1]?.monthlyContributionEurMinor).toBe(100);
  });

  it.each([
    { accountUuid: "cash" },
    { filter: { type: "account" as const, accountUuids: ["cash"] } },
    { filter: { type: "category" as const, categoryUuids: ["category"] } },
  ])("keeps global flow and income with selected budget restrictions %j", (restriction) => {
    const rows = [
      coverage("2026-01-01"), coverage("2026-01-31"),
      income("salary", "2026-01-05", 1_000),
      income("other-income", "2026-01-06", 2_000, { accountId: "other" }),
      posting("cash-cost", "2026-01-10", -200),
      posting("other-cost", "2026-01-11", -300, { accountId: "other", categoryPath: ["Other expense"] }),
      income("today-income", "2026-02-15", 3_500, { accountId: "other" }),
    ];
    const selected = budget(restriction);
    const filters = createDefaultFilterState();
    const current = analyzeBudgetPeriod(dataset(rows, selected), applyFilters(dataset(rows, selected), filters), selected, "MONTH:2026:0");
    expect(current.status).toBe("ready");
    if (current.status !== "ready") return;
    // The budget view is scoped, but its annual projection must not reuse that scope.
    expect(current.analysis.filteredPostingCount).toBeLessThan(rows.length);
    const result = project(dataset(rows, selected), filters, "2026-02-15");
    expect(result).toEqual(project(dataset(rows), filters, "2026-02-15"));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income).toMatchObject({ completeMonthCount: 1, expectedMonthlyMinor: 3_000 });
    expect(result.points.slice(0, 3)).toMatchObject([
      { kind: "actual", monthlyContributionEurMinor: 2_500, cumulativeEurMinor: 2_500 },
      { kind: "estimated", incomeMinor: 3_500, budgetMinor: 500, monthlyContributionEurMinor: 3_000, cumulativeEurMinor: 5_500 },
      { kind: "estimated", incomeMinor: 3_000, budgetMinor: 500, monthlyContributionEurMinor: 2_500, cumulativeEurMinor: 8_000 },
    ]);
    expect(project(dataset(rows, selected), { ...filters, accountIds: ["cash"] })).toEqual({ status: "unavailable", reason: "filtered-scope" });
    expect(project(dataset(rows, selected), { ...filters, categoryPrefixes: [["Expense"]] })).toEqual({ status: "unavailable", reason: "filtered-scope" });
  });

  it("rejects incompatible budget currency and content-filtered comparisons", () => {
    const rows = [coverage("2026-01-01"), coverage("2026-01-31")];
    expect(project(dataset(rows, budget({ currency: "GBP" })))).toEqual({ status: "unavailable", reason: "incompatible-currency" });
    expect(project(dataset(rows), { ...createDefaultFilterState(), tags: ["keep"] })).toEqual({ status: "unavailable", reason: "filtered-scope" });
  });

  it("uses civil-month actuals even when imported budget months start mid-month", () => {
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"),
      income("jan", "2026-01-20", 1_000), posting("jan-cost", "2026-01-20", -250),
    ], budget(), { ...preferences, monthStart: 15 }));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.points[0]).toMatchObject({ startDate: "2026-01-01", endDate: "2026-01-31", monthlyContributionEurMinor: 750 });
    expect(result.budget.distribution).toBe("per-calendar-month-label");
  });

  it("excludes internal transfers and income-shaped debt adjustments from income estimates", () => {
    const internal = income("internal", "2026-01-20", 600, { linked: true, transferPeerPostingId: "internal-peer" });
    const internalPeer = posting("internal-peer", "2026-01-20", -600, { accountId: "other", linked: true, transferPeerPostingId: "internal", bucket: "transfer", categoryType: "TRANSFER" });
    const debtAdjustment = income("debt-adjustment", "2026-01-21", 400, { linked: true, transferPeerPostingId: "debt-peer" });
    const debtPeer = posting("debt-peer", "2026-01-21", -400, { accountId: "debt", accountType: "DEBT", linked: true, transferPeerPostingId: "debt-adjustment" });
    const result = project(dataset([
      coverage("2026-01-01"), coverage("2026-01-31"), income("salary", "2026-01-05", 1_000),
      internal, internalPeer, debtAdjustment, debtPeer,
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.income.expectedMonthlyMinor).toBe(1_000);
    expect(result.points[0]?.monthlyContributionEurMinor).toBe(1_400);
  });
});
