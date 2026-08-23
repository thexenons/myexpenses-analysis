import { describe, expect, it } from "vitest";

import type {
  BackupBudgetGrouping,
  BackupBudgetV1,
  BackupDatasetV1,
} from "./backup-dataset.types.ts";
import {
  analyzeBudgetPeriod,
  resolveBudgetAllocation,
  resolveBudgetPeriods,
} from "./budgets.ts";
import { applyFilters, createDefaultFilterState } from "./filters.ts";
import type {
  AnalyticsDataset,
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
