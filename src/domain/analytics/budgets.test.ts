import { describe, expect, it } from "vitest";

import type {
  BackupBudgetGrouping,
  BackupBudgetV1,
  BackupDatasetV1,
} from "./backup-dataset.types.ts";
import {
  analyzeBudgetPeriod,
  budgetContributionsForPath,
  resolveBudgetAllocation,
  resolveBudgetPeriods,
} from "./budgets.ts";
import { analyzeBudgetPace } from "./budget-pace.ts";
import { dateRangeForPeriod } from "./date-periods.ts";
import { applyFilters, createDefaultFilterState } from "./filters.ts";
import type {
  AnalyticsDataset,
  FilterState,
  IsoDate,
  NormalizedPosting,
} from "./types.ts";

const preferences: BackupDatasetV1["preferences"] = {
  homeCurrency: "EUR",
  timeZone: "Europe/Madrid",
  monthStart: 1,
  weekStart: 1,
  includeTransfers: true,
};

function budgetFixture(
  overrides: Partial<BackupBudgetV1> = {},
): BackupBudgetV1 {
  return {
    uuid: "budget",
    sourceId: 1,
    title: "Presupuesto doméstico",
    description: "",
    grouping: "MONTH",
    accountUuid: null,
    currency: "EUR",
    startDate: null,
    endDate: null,
    isDefault: true,
    filter: null,
    aggregateNeutral: false,
    allocations: [
      {
        categoryUuid: null,
        year: null,
        period: null,
        amountMinor: 10_000,
        rolloverPreviousMinor: 0,
        rolloverNextMinor: 0,
        oneTime: false,
      },
      {
        categoryUuid: "root",
        year: 2026,
        period: 5,
        amountMinor: 8_000,
        rolloverPreviousMinor: 0,
        rolloverNextMinor: 0,
        oneTime: false,
      },
      {
        categoryUuid: "root",
        year: 2026,
        period: 7,
        amountMinor: null,
        rolloverPreviousMinor: 1_000,
        rolloverNextMinor: 0,
        oneTime: false,
      },
      {
        categoryUuid: "child",
        year: 2026,
        period: 7,
        amountMinor: 3_000,
        rolloverPreviousMinor: 0,
        rolloverNextMinor: 0,
        oneTime: false,
      },
    ],
    ...overrides,
  };
}

function posting(
  id: string,
  date: IsoDate,
  amountEurMinor: number,
  categoryPath: readonly string[],
  options: { bucket?: "expense" | "income"; isVoid?: boolean } = {},
): NormalizedPosting {
  return {
    id,
    transactionId: id,
    sourceTransactionId: id,
    accountId: "account",
    accountLabel: "Cuenta",
    accountType: "DEFAULT",
    currency: "EUR",
    fractionDigits: 2,
    date,
    amountNativeMinor: amountEurMinor,
    amountEurMinor,
    exchangeRateToEur: 1,
    exchangeRateSource: "identity",
    categoryPath,
    categoryType: options.bucket === "income" ? "INCOME" : "EXPENSE",
    bucket: options.bucket ?? "expense",
    status: options.isVoid ? "VOID" : "RECONCILED",
    isVoid: options.isVoid ?? false,
    linked: false,
    tags: [],
    splitIndex: null,
    splitCount: null,
    searchIndex: id,
  };
}

function analyticsFixture(): AnalyticsDataset {
  const budgets = [budgetFixture()];
  const categories: BackupDatasetV1["categories"] = [
    {
      uuid: "root",
      sourceId: 1,
      name: "Gastos",
      type: "EXPENSE",
      parentUuid: null,
      path: ["Gastos"],
      color: null,
      icon: null,
    },
    {
      uuid: "child",
      sourceId: 2,
      name: "Comida",
      type: "EXPENSE",
      parentUuid: "root",
      path: ["Gastos", "Comida"],
      color: null,
      icon: null,
    },
    {
      uuid: "other",
      sourceId: 3,
      name: "Otros",
      type: "EXPENSE",
      parentUuid: null,
      path: ["Otros"],
      color: null,
      icon: null,
    },
  ];
  const postings = [
    posting("expense", "2026-08-03", -4_000, ["Gastos", "Comida"]),
    posting("refund", "2026-08-04", 500, ["Gastos", "Comida"]),
    posting("root-expense", "2026-08-05", -1_000, ["Gastos"]),
    posting("unallocated", "2026-08-06", -2_000, ["Otros"]),
    posting("void", "2026-08-07", -99_900, ["Gastos", "Comida"], {
      isVoid: true,
    }),
    posting("outside", "2026-07-31", -1_000, ["Gastos", "Comida"]),
    posting("income", "2026-08-08", 20_000, ["Ingresos"], {
      bucket: "income",
    }),
  ];
  return {
    currency: "EUR",
    source: {
      accounts: {
        version: 2,
        accounts: { account: { label: "Cuenta", type: "DEFAULT" } },
      },
      categories: {},
    },
    accounts: [
      {
        id: "account",
        label: "Cuenta",
        currency: "EUR",
        fractionDigits: 2,
        type: "DEFAULT",
        exchangeRateMode: "IDENTITY",
        openingBalanceNativeMinor: 0,
        openingBalanceEurMinor: 0,
        currentBalanceNativeMinor: 0,
        historicalBalanceEurMinor: 0,
        valuationBalanceEurMinor: 0,
        postingCount: postings.length,
        activePostingCount: postings.length - 1,
      },
    ],
    postings,
    minDate: "2026-07-31",
    maxDate: "2026-08-08",
    backup: {
      source: {
        format: "myexpenses-backup",
        schemaVersion: 189,
        backupSha256: "a".repeat(64),
        databaseSha256: "b".repeat(64),
      },
      preferences,
      currencies: [
        {
          sourceId: 1,
          code: "EUR",
          fractionDigits: 2,
          label: "Euro",
          symbol: "€",
          commodityType: "FIAT",
        },
      ],
      accounts: [
        {
          uuid: "account",
          sourceId: 1,
          label: "Cuenta",
          description: null,
          currency: "EUR",
          fractionDigits: 2,
          nativeType: "CASH",
          scope: "DEFAULT",
          parentUuid: null,
          openingNativeMinor: 0,
          openingHomeMinor: 0,
          exchangeRateMode: "IDENTITY",
          exchangeRateToHome: 1,
          flags: {
            sourceId: 0,
            visible: true,
            excludedFromTotals: false,
            includedInAll: true,
            isAsset: true,
            supportsReconciliation: false,
          },
        },
      ],
      categories,
      payees: [],
      paymentMethods: [],
      tags: [],
      budgets,
    },
  };
}

function debtAnalyticsFixture(): AnalyticsDataset {
  const base = analyticsFixture();
  const debtAccount = {
    ...base.accounts[0]!,
    id: "debt",
    label: "Debt",
    type: "DEBT" as const,
  };
  const shared = {
    ...posting("shared", "2026-08-03", -500, ["Gastos", "Comida"]),
    linked: true,
    splitIndex: 1,
    splitCount: 2,
    transferPeerPostingId: "mirror",
  };
  const refund = {
    ...posting("refund", "2026-08-04", 200, ["Gastos", "Comida"]),
    linked: true,
    transferPeerPostingId: "refund-mirror",
  };
  const debtPosting = (row: NormalizedPosting): NormalizedPosting => ({
    ...row,
    accountId: debtAccount.id,
    accountLabel: debtAccount.label,
    accountType: debtAccount.type,
  });
  return {
    ...base,
    accounts: [...base.accounts, debtAccount],
    postings: [
      { ...posting("own", "2026-08-03", -500, ["Gastos"]), splitIndex: 0, splitCount: 2 },
      shared,
      refund,
      debtPosting({ ...shared, id: "mirror", amountEurMinor: 500, amountNativeMinor: 500, transferPeerPostingId: "shared" }),
      debtPosting({ ...refund, id: "refund-mirror", amountEurMinor: -200, amountNativeMinor: -200, transferPeerPostingId: "refund" }),
      debtPosting(posting("card", "2026-08-05", -1_000, ["Otros"])),
      debtPosting(posting("card-refund", "2026-08-06", 100, ["Otros"])),
    ],
    backup: {
      ...base.backup!,
      accounts: [...base.backup!.accounts, {
        ...base.backup!.accounts[0]!,
        uuid: debtAccount.id,
        label: debtAccount.label,
        nativeType: "LIABILITY",
        scope: "DEBT",
      }],
    },
  };
}

function paceAnalysis(
  analytics: AnalyticsDataset,
  filters: FilterState = createDefaultFilterState(),
  periodKey = "MONTH:2026:7",
) {
  const result = analyzeBudgetPeriod(analytics, applyFilters(analytics, filters), analytics.backup!.budgets[0]!, periodKey);
  if (result.status !== "ready") throw new Error(result.reason);
  return result.analysis;
}

describe("linear budget pace", () => {
  it("uses inclusive calendar days and assigned incoming rollover without changing totals", () => {
    const analytics = analyticsFixture();
    const analysis = paceAnalysis(analytics);
    const original = structuredClone(analysis);
    const pace = analyzeBudgetPace(analysis, "2026-08-04");
    if (pace.status !== "ready") throw new Error(pace.reason);
    expect(pace).toMatchObject({
      status: "ready", currency: "EUR", fractionDigits: 2,
      basis: { grouping: "MONTH", periodStartDate: "2026-08-01", periodEndDate: "2026-08-31",
        cutoffDate: "2026-08-04", elapsedUnits: 4, totalUnits: 31, fraction: 4 / 31 },
      global: { status: "ready", assignedMinor: 11_000, actualToDateMinor: 3_500,
        expectedMinor: 11_000 * 4 / 31, differenceMinor: 11_000 * 4 / 31 - 3_500 },
    });
    const root = pace.categories.find((item) => item.categoryUuid === "root");
    const child = pace.categories.find((item) => item.categoryUuid === "child");
    expect(root).toMatchObject({ status: "ready", assignedMinor: 9_000, actualToDateMinor: 3_500 });
    expect(child).toMatchObject({ status: "ready", assignedMinor: 3_000, actualToDateMinor: 3_500 });
    expect(analysis).toEqual(original);
    const withOutgoing = budgetFixture({ allocations: budgetFixture().allocations.map((entry, index) =>
      Object.assign({}, entry, { rolloverNextMinor: index === 0 ? 5_000 : entry.rolloverNextMinor })) });
    const outgoingData = { ...analytics, backup: { ...analytics.backup!, budgets: [withOutgoing] } };
    expect(analyzeBudgetPace(paceAnalysis(outgoingData), "2026-08-04")).toMatchObject({
      status: "ready", global: { assignedMinor: 11_000, expectedMinor: 11_000 * 4 / 31 },
    });
  });

  it("includes first and last days, but never counts future postings in actual-to-date", () => {
    const analytics = analyticsFixture();
    expect(analyzeBudgetPace(paceAnalysis(analytics), "2026-08-01")).toMatchObject({
      status: "ready", basis: { elapsedUnits: 1, totalUnits: 31 },
      global: { actualToDateMinor: 0 },
    });
    expect(analyzeBudgetPace(paceAnalysis(analytics), "2026-08-31")).toMatchObject({
      status: "ready", basis: { fraction: 1 }, global: { actualToDateMinor: 6_500, expectedMinor: 11_000 },
    });
    expect(analyzeBudgetPace(paceAnalysis(analytics), "2026-09-01")).toMatchObject({
      status: "ready", basis: { cutoffDate: "2026-08-31", fraction: 1 },
    });
    expect(analyzeBudgetPace(paceAnalysis(analytics), "2026-07-31")).toMatchObject({ status: "unavailable", reason: "future-period" });
  });

  it("uses 29 leap-February days and fractional annual months", () => {
    const monthly = budgetFixture({ allocations: [{ ...budgetFixture().allocations[0]!, year: 2024, period: 1, amountMinor: 2_900 }] });
    const base = analyticsFixture();
    const february = { ...base, backup: { ...base.backup!, budgets: [monthly] } };
    expect(analyzeBudgetPace(paceAnalysis(february, createDefaultFilterState(), "MONTH:2024:1"), "2024-02-15")).toMatchObject({
      status: "ready", basis: { elapsedUnits: 15, totalUnits: 29, fraction: 15 / 29 },
      global: { expectedMinor: 1_500 },
    });
    const yearly = budgetFixture({ grouping: "YEAR", allocations: [{ ...monthly.allocations[0]!, year: 2024, period: 0, amountMinor: 12_000 }] });
    const annualData = { ...base, backup: { ...base.backup!, budgets: [yearly] } };
    expect(analyzeBudgetPace(paceAnalysis(annualData, createDefaultFilterState(), "YEAR:2024:0"), "2024-02-15")).toMatchObject({
      status: "ready", basis: { elapsedUnits: 1 + 15 / 29, totalUnits: 12, fraction: (1 + 15 / 29) / 12 },
      global: { expectedMinor: 1_000 * (1 + 15 / 29) },
    });
    expect(analyzeBudgetPace(paceAnalysis(annualData, createDefaultFilterState(), "YEAR:2024:0"), "2024-01-01"))
      .toMatchObject({ status: "ready", basis: { elapsedUnits: 1 / 31 } });
    expect(analyzeBudgetPace(paceAnalysis(annualData, createDefaultFilterState(), "YEAR:2024:0"), "2024-12-31"))
      .toMatchObject({ status: "ready", basis: { elapsedUnits: 12, fraction: 1 }, global: { expectedMinor: 12_000 } });
    const shifted = { ...february, backup: { ...february.backup!, preferences: { ...preferences, monthStart: 15 } } };
    expect(analyzeBudgetPace(paceAnalysis(shifted, createDefaultFilterState(), "MONTH:2024:1"), "2024-02-29"))
      .toMatchObject({ status: "ready", basis: { periodStartDate: "2024-02-15", periodEndDate: "2024-03-14",
        elapsedUnits: 15, totalUnits: 29 } });
  });

  it("uses selected value-date basis and budget-native currency contribution signs", () => {
    const base = analyticsFixture();
    const budget = budgetFixture({ currency: "GBP", accountUuid: "account" });
    const rows = [
      { ...posting("charge", "2026-08-10", -100, ["Gastos", "Comida"]), valueDate: "2026-08-03" as const,
        currency: "GBP" as const, amountNativeMinor: -600 },
      { ...posting("refund", "2026-08-11", 20, ["Gastos", "Comida"]), valueDate: "2026-08-04" as const,
        currency: "GBP" as const, amountNativeMinor: 200 },
      { ...posting("future", "2026-08-12", -50, ["Gastos", "Comida"]), valueDate: "2026-08-20" as const,
        currency: "GBP" as const, amountNativeMinor: -300 },
    ];
    const analytics = { ...base, postings: rows, backup: { ...base.backup!,
      currencies: [...base.backup!.currencies, { ...base.backup!.currencies[0]!, code: "GBP" as const }],
      accounts: base.backup!.accounts.map((account) => Object.assign({}, account, { currency: "GBP" as const })), budgets: [budget] } };
    const analysis = paceAnalysis(analytics, { ...createDefaultFilterState(), dateBasis: "value" });
    expect(analyzeBudgetPace(analysis, "2026-08-04")).toMatchObject({
      status: "ready", currency: "GBP", basis: { dateBasis: "value" },
      global: { actualToDateMinor: 400 },
      categories: expect.arrayContaining([expect.objectContaining({ categoryUuid: "child", actualToDateMinor: 400 })]),
    });
  });

  it("suppresses filtered comparisons and zero/negative limits instead of implying full-budget pace", () => {
    const base = analyticsFixture();
    const filtered = paceAnalysis(base, { ...createDefaultFilterState(), minAmountEurMinor: 0 });
    expect(analyzeBudgetPace(filtered, "2026-08-04")).toMatchObject({ status: "unavailable", reason: "filtered-comparison" });
    for (const amountMinor of [0, -1]) {
      const budget = budgetFixture({ allocations: [{ ...budgetFixture().allocations[0]!, year: 2026, period: 7, amountMinor }] });
      const analytics = { ...base, backup: { ...base.backup!, budgets: [budget] } };
      expect(analyzeBudgetPace(paceAnalysis(analytics), "2026-08-04")).toMatchObject({
        status: "ready", global: { status: "unavailable", reason: "non-positive-limit" },
      });
    }
    const categoryBudget = budgetFixture({ allocations: budgetFixture().allocations.map((entry) =>
      entry.categoryUuid === "root" && entry.period === 7
        ? Object.assign({}, entry, { amountMinor: 0, rolloverPreviousMinor: 0 }) : entry) });
    const categoryData = { ...base, backup: { ...base.backup!, budgets: [categoryBudget] } };
    expect(analyzeBudgetPace(paceAnalysis(categoryData), "2026-08-04")).toMatchObject({
      status: "ready", global: { status: "ready" },
      categories: expect.arrayContaining([expect.objectContaining({ categoryUuid: "root", status: "unavailable", reason: "non-positive-limit" })]),
    });
  });

  it("allows only a complete period-to-today date prefix, not a truncated date cut", () => {
    const analytics = analyticsFixture();
    const today = "2026-08-04";
    const monthToDate = paceAnalysis(analytics, { ...createDefaultFilterState(), periodMode: "month",
      dateRange: dateRangeForPeriod("month", today, today) });
    expect(monthToDate.isFilteredComparison).toBe(true);
    expect(analyzeBudgetPace(monthToDate, today)).toMatchObject({
      status: "ready", global: { actualToDateMinor: 3_500, expectedMinor: 11_000 * 4 / 31 },
    });
    const throughTomorrow = paceAnalysis(analytics, { ...createDefaultFilterState(),
      dateRange: { from: "2026-08-01", to: "2026-08-05" } });
    expect(analyzeBudgetPace(throughTomorrow, today)).toMatchObject({
      status: "ready", global: { actualToDateMinor: 3_500 },
    });
    const missingStart = paceAnalysis(analytics, { ...createDefaultFilterState(),
      dateRange: { from: "2026-08-02", to: today } });
    expect(analyzeBudgetPace(missingStart, today)).toMatchObject({ status: "unavailable", reason: "filtered-comparison" });
    const earlyEnd = paceAnalysis(analytics, { ...createDefaultFilterState(),
      dateRange: { from: "2026-08-01", to: "2026-08-03" } });
    expect(analyzeBudgetPace(earlyEnd, today)).toMatchObject({ status: "unavailable", reason: "filtered-comparison" });
    const tagged = paceAnalysis(analytics, { ...createDefaultFilterState(), tags: ["keep"],
      dateRange: { from: "2026-08-01", to: today } });
    expect(analyzeBudgetPace(tagged, today)).toMatchObject({ status: "unavailable", reason: "filtered-comparison" });
  });

  it("uses the already reconciled debt-mirror contribution signs", () => {
    const analysis = paceAnalysis(debtAnalyticsFixture());
    expect(analysis.global.consumedMinor).toBe(1_400);
    expect(analyzeBudgetPace(analysis, "2026-08-04")).toMatchObject({
      status: "ready", global: { actualToDateMinor: 500 },
      categories: expect.arrayContaining([
        expect.objectContaining({ categoryUuid: "root", actualToDateMinor: 500 }),
        expect.objectContaining({ categoryUuid: "child", actualToDateMinor: 0 }),
      ]),
    });
  });

  it("explicitly rejects day/week/custom period pacing", () => {
    const analysis = paceAnalysis(analyticsFixture());
    for (const grouping of ["DAY", "WEEK", "NONE"] as const) {
      expect(analyzeBudgetPace({ ...analysis, period: { ...analysis.period, grouping } }, "2026-08-04"))
        .toMatchObject({ status: "unavailable", reason: "unsupported-grouping" });
    }
  });
});

describe("budget debt contributions", () => {
  it.each([
    ["debtsOnly", 1_200],
    ["all", 1_400],
    ["realCashFlow", 800],
  ] as const)("reconciles mixed shared splits, direct charges and refunds in %s", (scope, consumedMinor) => {
    const analytics = debtAnalyticsFixture();
    const original = structuredClone(analytics);
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope });
    const result = analyzeBudgetPeriod(analytics, filtered, analytics.backup!.budgets[0]!);
    if (result.status !== "ready") throw new Error(result.reason);
    const { global, contributions, allocations, categorizedConsumedMinor, unallocatedConsumedMinor } = result.analysis;
    expect(global.consumedMinor).toBe(consumedMinor);
    expect(global.availableMinor).toBe(global.assignedMinor - consumedMinor);
    expect(global.utilization).toBe(consumedMinor / global.assignedMinor);
    expect(contributions.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(consumedMinor);
    expect(categorizedConsumedMinor + unallocatedConsumedMinor).toBe(consumedMinor);
    for (const node of [allocations[0]!, ...allocations[0]!.children]) {
      expect(budgetContributionsForPath(contributions, node.path).reduce((sum, entry) => sum + entry.amountMinor, 0))
        .toBe(node.consumedMinor);
    }
    const expectedDebtAmounts = scope === "realCashFlow" ? [] : scope === "debtsOnly"
      ? [["mirror", 500], ["refund-mirror", -200], ["card", 1_000], ["card-refund", -100]]
      : [["mirror", -500], ["refund-mirror", 200], ["card", 1_000], ["card-refund", -100]];
    expect(contributions.filter(({ posting: row }) => row.accountType === "DEBT")
      .map(({ posting: row, amountMinor }) => [row.id, amountMinor])).toEqual(expectedDebtAmounts);
    for (const entry of contributions) expect(entry.posting).toBe(analytics.postings.find((row) => row.id === entry.posting.id));
    expect(analytics).toEqual(original);
  });

  it.each([
    ["missing peer", "mirror", { transferPeerPostingId: "missing" }],
    ["nonreciprocal peer", "shared", { transferPeerPostingId: "refund-mirror" }],
    ["same signs", "shared", { amountNativeMinor: 500 }],
    ["zero native amount", "shared", { amountNativeMinor: 0 }],
    ["same account", "shared", { accountId: "debt", accountType: "DEBT" }],
    ["missing account", "shared", { accountId: "missing" }],
    ["VOID counterpart", "shared", { isVoid: true, status: "VOID" }],
    ["debt counterpart", "shared", { accountId: "another-debt", accountType: "DEBT" }],
  ] satisfies ReadonlyArray<readonly [string, string, Partial<NormalizedPosting>]>)("does not reinterpret a %s", (_, id, override) => {
    const base = debtAnalyticsFixture();
    const analytics: AnalyticsDataset = {
      ...base,
      accounts: [...base.accounts, { ...base.accounts[1]!, id: "another-debt" }],
      postings: base.postings.map((row) => row.id === id ? Object.assign({}, row, override) : row),
    };
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope: "debtsOnly", accountIds: ["debt"] });
    const result = analyzeBudgetPeriod(analytics, filtered, analytics.backup!.budgets[0]!);
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.contributions.find(({ posting: row }) => row.id === "mirror")?.amountMinor).toBe(-500);
  });

  it("verifies native signs even when the operational home amount rounds to zero", () => {
    const base = debtAnalyticsFixture();
    const analytics: AnalyticsDataset = {
      ...base,
      postings: base.postings.map((row) => row.id === "shared" ? Object.assign({}, row, { amountEurMinor: 0 }) : row),
    };
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope: "debtsOnly" });
    const result = analyzeBudgetPeriod(analytics, filtered, analytics.backup!.budgets[0]!);
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.contributions.find(({ posting: row }) => row.id === "mirror")?.amountMinor).toBe(500);
  });

  it.each(["EUR", "GBP"] as const)("preserves selected-posting values and categories for a %s budget", (currency) => {
    const base = debtAnalyticsFixture();
    const analytics: AnalyticsDataset = {
      ...base,
      accounts: base.accounts.map((account) => account.type === "DEBT" ? Object.assign({}, account, { currency: "GBP" as const }) : account),
      postings: base.postings.map((row) => row.accountType === "DEBT"
        ? Object.assign({}, row, { currency: "GBP" as const, amountNativeMinor: row.amountEurMinor * 2 })
        : Object.assign({}, row, { categoryPath: ["Otros"], amountEurMinor: row.amountEurMinor - 20 })),
      backup: {
        ...base.backup!,
        accounts: base.backup!.accounts.map((account) => account.scope === "DEBT" ? Object.assign({}, account, { currency: "GBP" as const }) : account),
        currencies: [...base.backup!.currencies, { sourceId: 2, code: "GBP", fractionDigits: 2, label: "Pound", symbol: "£", commodityType: "FIAT" }],
      },
    };
    const budget = budgetFixture({ currency, accountUuid: "debt" });
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope: "debtsOnly" });
    // A home-currency budget spans accounts; an account budget uses that account's currency.
    const result = analyzeBudgetPeriod(analytics, filtered, currency === "EUR" ? { ...budget, accountUuid: null } : budget);
    if (result.status !== "ready") throw new Error(result.reason);
    const mirror = result.analysis.contributions.find(({ posting: row }) => row.id === "mirror")!;
    expect(mirror.amountMinor).toBe(currency === "EUR" ? 500 : 1_000);
    expect(mirror.posting.categoryPath).toEqual(["Gastos", "Comida"]);
    expect(result.analysis.global.consumedMinor).toBe(currency === "EUR" ? 1_200 : 2_400);
  });

  it.each([false, true])("retains uncategorized neutral inclusion with aggregateNeutral=%s", (aggregateNeutral) => {
    const base = debtAnalyticsFixture();
    const analytics: AnalyticsDataset = {
      ...base,
      postings: base.postings.map((row) => row.id === "mirror"
        ? Object.assign({}, row, { categoryPath: [], categoryType: "NEUTRAL" as const, bucket: "income" as const })
        : row),
    };
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope: "debtsOnly" });
    const result = analyzeBudgetPeriod(analytics, filtered, budgetFixture({ aggregateNeutral }));
    if (result.status !== "ready") throw new Error(result.reason);
    const mirror = result.analysis.contributions.find(({ posting: row }) => row.id === "mirror");
    expect(mirror).toEqual(aggregateNeutral
      ? { amountMinor: 500, posting: analytics.postings.find((row) => row.id === "mirror") }
      : undefined);
    expect(result.analysis.unallocatedConsumedMinor).toBe(aggregateNeutral ? 1_400 : 900);
  });

  it("preserves missing limits and excludes VOID debt postings", () => {
    const base = debtAnalyticsFixture();
    const analytics: AnalyticsDataset = {
      ...base,
      postings: base.postings.map((row) => row.id === "refund-mirror" ? Object.assign({}, row, { isVoid: true, status: "VOID" as const }) : row),
    };
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope: "debtsOnly" });
    const result = analyzeBudgetPeriod(analytics, filtered, budgetFixture({
      allocations: [{ categoryUuid: null, year: 2026, period: 7, amountMinor: 0, rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false }],
    }));
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.global).toMatchObject({ consumedMinor: 1_400, assignedMinor: 0, utilization: null });
    expect(result.analysis.contributions.some(({ posting: row }) => row.id === "refund-mirror")).toBe(false);
  });
});

describe("budget periods", () => {
  it("treats MONTH second as zero-based and models every safe grouping", () => {
    const cases: Array<{
      grouping: BackupBudgetGrouping;
      allocationYear: number | null;
      allocationPeriod: number | null;
      startDate: string;
      endDate: string;
      dates?: Pick<BackupBudgetV1, "startDate" | "endDate">;
    }> = [
      {
        grouping: "DAY",
        allocationYear: 2026,
        allocationPeriod: 32,
        startDate: "2026-02-01",
        endDate: "2026-02-01",
      },
      {
        grouping: "WEEK",
        allocationYear: 2026,
        allocationPeriod: 1,
        startDate: "2026-01-05",
        endDate: "2026-01-11",
      },
      {
        grouping: "MONTH",
        allocationYear: 2026,
        allocationPeriod: 7,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
      {
        grouping: "YEAR",
        allocationYear: 2026,
        allocationPeriod: null,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      {
        grouping: "NONE",
        allocationYear: null,
        allocationPeriod: null,
        startDate: "2026-02-10",
        endDate: "2026-03-12",
        dates: { startDate: "2026-02-10", endDate: "2026-03-12" },
      },
    ];

    for (const item of cases) {
      const budget = budgetFixture({
        grouping: item.grouping,
        ...(item.dates ?? { startDate: null, endDate: null }),
        allocations: [
          {
            categoryUuid: null,
            year: item.allocationYear,
            period: item.allocationPeriod,
            amountMinor: 1_000,
            rolloverPreviousMinor: 0,
            rolloverNextMinor: 0,
            oneTime: false,
          },
        ],
      });
      const result = resolveBudgetPeriods(budget, preferences);
      if (result.status !== "ready") throw new Error(result.reason);
      expect(result.periods[0]).toMatchObject({
        startDate: item.startDate,
        endDate: item.endDate,
      });
    }
  });

  it("reports an unsafe unbounded NONE budget instead of inventing dates", () => {
    expect(
      resolveBudgetPeriods(
        budgetFixture({ grouping: "NONE", startDate: null, endDate: null }),
        preferences,
      ),
    ).toMatchObject({ status: "unsupported", reason: expect.any(String) });
  });
});

describe("budget analysis", () => {
  it("exposes exact signed posting contributions without duplicating category subtrees", () => {
    const analytics = analyticsFixture();
    const result = analyzeBudgetPeriod(
      analytics,
      applyFilters(analytics, createDefaultFilterState()),
      analytics.backup!.budgets[0]!,
      "MONTH:2026:7",
    );
    if (result.status !== "ready") throw new Error(result.reason);

    expect(result.analysis.contributions.map(({ posting: row, amountMinor }) => [row.id, amountMinor])).toEqual([
      ["expense", 4_000],
      ["refund", -500],
      ["root-expense", 1_000],
      ["unallocated", 2_000],
    ]);
    expect(result.analysis.contributions.reduce((sum, entry) => sum + entry.amountMinor, 0))
      .toBe(result.analysis.global.consumedMinor);
    const root = result.analysis.allocations[0]!;
    const rootEntries = budgetContributionsForPath(result.analysis.contributions, root.path);
    expect(rootEntries.map(({ posting: row }) => row.id)).toEqual(["expense", "refund", "root-expense"]);
    expect(rootEntries.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(root.consumedMinor);
    const childEntries = budgetContributionsForPath(result.analysis.contributions, root.children[0]!.path);
    expect(childEntries.map(({ posting: row }) => row.id)).toEqual(["expense", "refund"]);
    expect(childEntries.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(root.children[0]!.consumedMinor);
  });
  it("rolls child base amounts and carryovers up exactly once", () => {
    const analytics = analyticsFixture();
    const childOnly = budgetFixture({
      allocations: [{
        categoryUuid: "child",
        year: 2026,
        period: 7,
        amountMinor: 3_000,
        rolloverPreviousMinor: 500,
        rolloverNextMinor: 200,
        oneTime: false,
      }],
    });
    const result = analyzeBudgetPeriod(
      analytics,
      applyFilters(analytics, createDefaultFilterState()),
      childOnly,
    );
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.allocations[0]).toMatchObject({
      allocationSource: "ROLLUP",
      baseMinor: 3_000,
      rolloverPreviousMinor: 500,
      rolloverNextMinor: 200,
      assignedMinor: 3_500,
      childAssignedMinor: 3_500,
      consumedMinor: 4_500,
      availableMinor: -1_000,
    });
    expect(result.analysis.categoryAssignedMinor).toBe(3_500);
  });

  it("leaves future allocations out of earlier category totals", () => {
    const analytics = analyticsFixture();
    const budget = budgetFixture({
      allocations: budgetFixture().allocations.map((allocation) =>
        allocation.categoryUuid === "root" ? Object.assign({}, allocation, { period: 9 }) : allocation,
      ),
    });
    const result = analyzeBudgetPeriod(
      analytics,
      applyFilters(analytics, createDefaultFilterState()),
      budget,
      "MONTH:2026:7",
    );
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.allocations[0]).toMatchObject({
      allocationSource: "ROLLUP",
      hasDirectAllocation: false,
      assignedMinor: 3_000,
    });
    expect(resolveBudgetAllocation([], result.analysis.period)).toMatchObject({
      source: "NONE",
      baseMinor: 0,
    });
  });

  it("uses the selected value date for both the global filter and the budget period", () => {
    const initial = analyticsFixture();
    const analytics = { ...initial, postings: initial.postings.map((row) => row.id === "outside" ? Object.assign({}, row, { valueDate: "2026-08-02" as const }) : row) };
    const filtered = applyFilters(analytics, {
      ...createDefaultFilterState(),
      dateBasis: "value",
      dateRange: { from: "2026-08-01", to: "2026-08-02" },
    });
    const result = analyzeBudgetPeriod(analytics, filtered, analytics.backup!.budgets[0]!, "MONTH:2026:7");
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.global.consumedMinor).toBe(1_000);
    expect(result.analysis.global.assignedMinor).toBe(11_000);
    expect(result.analysis.consumptionDateRange).toEqual({ from: "2026-08-01", to: "2026-08-02" });
    expect(result.analysis.dateBasis).toBe("value");
    expect(result.analysis.contributions.map(({ posting: row }) => row.id)).toEqual(["outside"]);
    expect(result.analysis.isFilteredComparison).toBe(true);
  });

  it("reports non-overlapping query dates without pretending the budget was prorated", () => {
    const analytics = analyticsFixture();
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), dateRange: { from: "2026-09-01", to: "2026-09-30" } });
    const result = analyzeBudgetPeriod(analytics, filtered, analytics.backup!.budgets[0]!, "MONTH:2026:7");
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.global.consumedMinor).toBe(0);
    expect(result.analysis.global.assignedMinor).toBe(11_000);
    expect(result.analysis.consumptionDateRange).toBeNull();
    expect(result.analysis.isFilteredComparison).toBe(true);
    expect(result.analysis.contributions).toEqual([]);
  });

  it.each([
    ["payee", { payeeKeys: ['["source",1]'] }, 4_000],
    ["payment method", { paymentMethodKeys: ['["source",2]'] }, 4_000],
    ["category type", { categoryTypes: ["INCOME"] }, 0],
    ["currency", { currencies: ["USD"] }, 0],
    ["minimum amount", { minAmountEurMinor: 3_000 }, 4_000],
    ["maximum amount", { maxAmountEurMinor: 1_000 }, 500],
    ["comment", { commentSearch: "receipt" }, 4_000],
    ["reference", { referenceSearch: "invoice" }, 4_000],
    ["zero minimum", { minAmountEurMinor: 0 }, 6_500],
    ["zero maximum", { maxAmountEurMinor: 0 }, 0],
  ] satisfies readonly (readonly [string, Partial<FilterState>, number])[])(
    "marks %s as a partial budget comparison without changing the period allocation",
    (_name, patch, consumedMinor) => {
      const initial = analyticsFixture();
      const analytics = {
        ...initial,
        postings: initial.postings.map((row) => row.id === "expense"
          ? Object.assign({}, row, { payeeSourceId: 1, paymentMethodSourceId: 2, comment: "Receipt", referenceNumber: "Invoice" })
          : row),
      };
      const filtered = applyFilters(analytics, { ...createDefaultFilterState(), ...patch });
      const result = analyzeBudgetPeriod(analytics, filtered, analytics.backup!.budgets[0]!, "MONTH:2026:7");
      if (result.status !== "ready") throw new Error(result.reason);
      expect(result.analysis.isFilteredComparison).toBe(true);
      expect(result.analysis.global).toMatchObject({
        assignedMinor: 11_000,
        consumedMinor,
        availableMinor: 11_000 - consumedMinor,
      });
    },
  );

  it("keeps the complete budget comparison when no subset filter is active", () => {
    const analytics = analyticsFixture();
    const result = analyzeBudgetPeriod(
      analytics,
      applyFilters(analytics, createDefaultFilterState()),
      analytics.backup!.budgets[0]!,
      "MONTH:2026:7",
    );
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.isFilteredComparison).toBe(false);
    expect(result.analysis.global).toMatchObject({ assignedMinor: 11_000, consumedMinor: 6_500, availableMinor: 4_500 });
  });

  it("applies fallback, rollovers, refunds and avoids parent-child double counting", () => {
    const analytics = analyticsFixture();
    const filtered = applyFilters(analytics, createDefaultFilterState());
    const result = analyzeBudgetPeriod(
      analytics,
      filtered,
      analytics.backup!.budgets[0]!,
      "MONTH:2026:7",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const root = result.analysis.allocations[0]!;
    expect(result.analysis.period).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    expect(result.analysis.global).toMatchObject({
      baseMinor: 10_000,
      rolloverPreviousMinor: 1_000,
      assignedMinor: 11_000,
      consumedMinor: 6_500,
      availableMinor: 4_500,
    });
    expect(root).toMatchObject({
      allocationSource: "FALLBACK",
      baseMinor: 8_000,
      rolloverPreviousMinor: 1_000,
      assignedMinor: 9_000,
      childAssignedMinor: 3_000,
      consumedMinor: 4_500,
      directConsumedMinor: 1_000,
    });
    expect(root.children[0]).toMatchObject({
      name: "Comida",
      consumedMinor: 3_500,
      assignedMinor: 3_000,
      health: "exceeded",
    });
    expect(result.analysis.categoryAssignedMinor).toBe(9_000);
    expect(result.analysis.unallocatedConsumedMinor).toBe(2_000);
    expect(result.analysis.filteredPostingCount).toBe(4);
  });

  it("respects global category/status filters before intersecting the period", () => {
    const analytics = analyticsFixture();
    const categoryFiltered = applyFilters(analytics, {
      ...createDefaultFilterState(),
      categoryPrefixes: [["Gastos", "Comida"]],
    });
    const categoryResult = analyzeBudgetPeriod(
      analytics,
      categoryFiltered,
      analytics.backup!.budgets[0]!,
    );
    if (categoryResult.status !== "ready") throw new Error(categoryResult.reason);
    expect(categoryResult.analysis.global.consumedMinor).toBe(3_500);
    expect(categoryResult.analysis.filteredPostingCount).toBe(2);
    expect(categoryResult.analysis.contributions.map(({ posting: row }) => row.id)).toEqual(["expense", "refund"]);

    const voidFiltered = applyFilters(analytics, {
      ...createDefaultFilterState(),
      statuses: ["VOID"],
    });
    const voidResult = analyzeBudgetPeriod(
      analytics,
      voidFiltered,
      analytics.backup!.budgets[0]!,
    );
    if (voidResult.status !== "ready") throw new Error(voidResult.reason);
    expect(voidResult.analysis.global.consumedMinor).toBe(0);
    expect(voidResult.analysis.filteredPostingCount).toBe(0);
    expect(voidResult.analysis.contributions).toEqual([]);
  });

  it("applies the budget's persisted account AND category filter on top of global filters", () => {
    const analytics = analyticsFixture();
    const filtered = applyFilters(analytics, createDefaultFilterState());
    const persistedFilterBudget = budgetFixture({
      filter: {
        type: "and",
        criteria: [
          { type: "account", accountUuids: ["account"] },
          {
            type: "category",
            categoryUuids: ["child", "other"],
          },
        ],
      },
    });
    const result = analyzeBudgetPeriod(
      analytics,
      filtered,
      persistedFilterBudget,
    );

    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.global.consumedMinor).toBe(5_500);
    expect(result.analysis.filteredPostingCount).toBe(3);
    expect(result.analysis.ownFilterApplied).toBe(true);
    expect(result.analysis.filterSummary).toEqual({
      rootOperator: "AND",
      accountCount: 1,
      categoryCount: 2,
    });
    expect(result.analysis.contributions.map(({ posting: row }) => row.id)).toEqual([
      "expense", "refund", "unallocated",
    ]);
  });

  it("keeps nested AND/OR/NOT budget predicates in the visible contribution set", () => {
    const analytics = analyticsFixture();
    const budget = budgetFixture({
      filter: {
        type: "and",
        criteria: [
          { type: "account", accountUuids: ["account"] },
          {
            type: "or",
            criteria: [
              { type: "category", categoryUuids: ["child"] },
              { type: "not", criterion: { type: "category", categoryUuids: ["other"] } },
            ],
          },
        ],
      },
    });
    const result = analyzeBudgetPeriod(analytics, applyFilters(analytics, createDefaultFilterState()), budget);
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.contributions.map(({ posting: row }) => row.id)).toEqual([
      "expense", "refund", "root-expense",
    ]);
    expect(result.analysis.contributions.reduce((sum, entry) => sum + entry.amountMinor, 0))
      .toBe(result.analysis.global.consumedMinor);
  });

  it("uses account-native minor units for a non-home-currency budget", () => {
    const base = analyticsFixture();
    const analytics: AnalyticsDataset = {
      ...base,
      postings: [
        ...base.postings.map((row) => Object.assign({}, row, { currency: "GBP" as const, amountNativeMinor: row.amountEurMinor * 2 })),
        { ...posting("euro", "2026-08-10", -8_000, ["Otros"]), accountId: "euro-account" },
      ],
      backup: {
        ...base.backup!,
        accounts: base.backup!.accounts.map((account) => Object.assign({}, account, { currency: "GBP" as const })),
        currencies: [
          ...base.backup!.currencies,
          { sourceId: 2, code: "GBP", fractionDigits: 2, label: "Pound", symbol: "£", commodityType: "FIAT" },
        ],
      },
    };
    const budget = budgetFixture({ currency: "GBP", accountUuid: "account" });
    const result = analyzeBudgetPeriod(analytics, applyFilters(analytics, createDefaultFilterState()), budget);
    if (result.status !== "ready") throw new Error(result.reason);
    expect(result.analysis.currency).toBe("GBP");
    expect(result.analysis.contributions.map(({ posting: row, amountMinor }) => [row.id, amountMinor])).toEqual([
      ["expense", 8_000], ["refund", -1_000], ["root-expense", 2_000], ["unallocated", 4_000],
    ]);
    expect(result.analysis.contributions.reduce((sum, entry) => sum + entry.amountMinor, 0))
      .toBe(result.analysis.global.consumedMinor);
  });

  it("includes positive neutral amounts as refunds only when aggregateNeutral is enabled", () => {
    const base = analyticsFixture();
    const neutralPosting: NormalizedPosting = {
      ...posting("neutral-refund", "2026-08-09", 500, ["Neutral"], {
        bucket: "income",
      }),
      categoryType: "NEUTRAL",
    };
    const neutralCategory: BackupDatasetV1["categories"][number] = {
      uuid: "neutral",
      sourceId: 4,
      name: "Neutral",
      type: "NEUTRAL",
      parentUuid: null,
      path: ["Neutral"],
      color: null,
      icon: null,
    };
    const analytics: AnalyticsDataset = {
      ...base,
      postings: [...base.postings, neutralPosting],
      backup: {
        ...base.backup!,
        categories: [...base.backup!.categories, neutralCategory],
      },
    };
    const filtered = applyFilters(analytics, createDefaultFilterState());
    const withoutNeutral = analyzeBudgetPeriod(
      analytics,
      filtered,
      budgetFixture({ aggregateNeutral: false }),
    );
    const withNeutral = analyzeBudgetPeriod(
      analytics,
      filtered,
      budgetFixture({ aggregateNeutral: true }),
    );

    if (withoutNeutral.status !== "ready") throw new Error(withoutNeutral.reason);
    if (withNeutral.status !== "ready") throw new Error(withNeutral.reason);
    expect(withoutNeutral.analysis.global.consumedMinor).toBe(6_500);
    expect(withNeutral.analysis.global.consumedMinor).toBe(6_000);
    expect(withoutNeutral.analysis.contributions.some(({ posting: row }) => row.id === "neutral-refund")).toBe(false);
    expect(withNeutral.analysis.contributions.at(-1)).toMatchObject({
      posting: { id: "neutral-refund" }, amountMinor: -500,
    });
  });

  it("uses the latest prior non-one-time allocation as fallback", () => {
    const periodResult = resolveBudgetPeriods(budgetFixture(), preferences);
    expect(periodResult.status).toBe("ready");
    if (periodResult.status !== "ready") return;
    const allocations = budgetFixture().allocations.filter(
      (allocation) => allocation.categoryUuid === "root",
    );
    expect(resolveBudgetAllocation(allocations, periodResult.periods[0]!)).toMatchObject({
      baseMinor: 8_000,
      rolloverPreviousMinor: 1_000,
      totalMinor: 9_000,
      source: "FALLBACK",
      sourceYear: 2026,
      sourceSecond: 5,
    });
  });

});
