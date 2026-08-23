import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  aggregateAccountBreakdown,
  aggregateCategoryBreakdown,
  aggregateDebtBreakdown,
  aggregateKpis,
  aggregateStatusCounts,
  aggregateTimeSeries,
} from "../../src/domain/analytics/aggregations.ts";
import {
  analyzeBudgetPeriod,
  flattenBudgetAllocationNodes,
} from "../../src/domain/analytics/budgets.ts";
import {
  applyFilters,
  createDefaultFilterState,
} from "../../src/domain/analytics/filters.ts";
import {
  dynamicRateKey,
  normalizeDataset,
  postingIdFor,
} from "../../src/domain/analytics/normalize.ts";
import type {
  AnalyticsDataset,
  AnalyticsSourceData,
  AnalyticsInputData,
  CategoriesRegistry,
  FilterState,
  ParsedDirectTransaction,
  TransactionStatus,
} from "../../src/domain/analytics/types.ts";

function withPeriodPreferences(
  dataset: AnalyticsDataset,
  monthStart: number,
  weekStart: number,
): AnalyticsDataset {
  return {
    ...dataset,
    backup: {
      source: {
        format: "myexpenses-backup",
        schemaVersion: 189,
        backupSha256: "a".repeat(64),
        databaseSha256: "b".repeat(64),
      },
      preferences: {
        homeCurrency: "EUR",
        timeZone: "Europe/Madrid",
        monthStart,
        weekStart,
        includeTransfers: false,
      },
      currencies: [],
      accounts: [],
      categories: [],
      payees: [],
      paymentMethods: [],
      tags: [],
      budgets: [],
    },
  };
}

interface TransactionExtras {
  readonly comment?: string;
  readonly tags?: readonly string[];
  readonly payee?: string;
  readonly transferAccount?: string;
  readonly status?: TransactionStatus;
}

function direct(
  uuid: string,
  date: `${number}-${number}-${number}`,
  amount: number,
  category: readonly string[],
  extras: TransactionExtras = {},
): ParsedDirectTransaction {
  return {
    uuid,
    date,
    amount,
    category,
    ...(extras.comment === undefined ? {} : { comment: extras.comment }),
    ...(extras.tags === undefined ? {} : { tags: extras.tags }),
    ...(extras.payee === undefined ? {} : { payee: extras.payee }),
    ...(extras.transferAccount === undefined
      ? {}
      : { transferAccount: extras.transferAccount }),
    sourceTransactionUuid: uuid,
    sourceStatus: extras.status ?? "UNRECONCILED",
    splitIndex: null,
    splitCount: null,
  };
}

const categories: CategoriesRegistry = {
  Gastos: {
    categoryType: "EXPENSE",
    children: {
      // Deliberately inconsistent: classification must still inherit EXPENSE.
      Casa: { categoryType: "INCOME" },
    },
  },
  Ingresos: { categoryType: "INCOME" },
  Transferencia: { categoryType: "TRANSFER" },
  "Reajuste*": { categoryType: "NEUTRAL" },
};

function fixtureSource(): AnalyticsSourceData {
  return {
    accounts: {
      version: 2,
      accounts: {
        cash: { label: "Cuenta diaria", type: "DEFAULT" },
        debt: { label: "Persona", type: "DEBT" },
        gbp: {
          label: "Ahorro GBP",
          type: "DEFAULT",
          exchangeRateMode: "STATIC",
          exchangeRateToEur: 1.25,
        },
      },
    },
    categories,
    parsedData: [
      {
        uuid: "cash",
        label: "Cuenta diaria",
        currency: "EUR",
        openingBalance: 100,
        transactions: [
          direct("expense", "2024-01-01", -10, ["Gastos", "Casa"], {
            comment: "Café de la mañana",
            tags: ["Casa"],
          }),
          direct("refund", "2024-01-02", 2, ["Gastos", "Casa"], {
            comment: "Devolución café",
            tags: ["Casa"],
            transferAccount: "Persona",
            status: "RECONCILED",
          }),
          direct("income", "2024-01-03", 100, ["Ingresos"]),
          direct("reversal", "2024-01-04", -5, ["Ingresos"]),
          // My Expenses uses the literal category, not structural linkage.
          direct("transfer", "2024-01-05", 20, ["Transferencia"]),
          direct("negative-neutral", "2024-01-06", -3, ["Reajuste*"]),
          direct("positive-neutral", "2024-01-07", 4, ["Reajuste*"]),
          direct("void", "2024-01-08", -999, ["Gastos", "Casa"], {
            status: "VOID",
          }),
        ],
      },
      {
        uuid: "debt",
        label: "Persona",
        currency: "EUR",
        openingBalance: 50,
        transactions: [
          direct("advance", "2024-01-01", -30, ["Gastos", "Casa"], {
            tags: ["Deuda"],
            transferAccount: "Cuenta diaria",
          }),
          direct("recovery", "2024-01-09", 10, ["Gastos", "Casa"], {
            tags: ["Deuda"],
            transferAccount: "Cuenta diaria",
          }),
        ],
      },
      {
        uuid: "gbp",
        label: "Ahorro GBP",
        currency: "GBP",
        openingBalance: 0,
        transactions: [
          direct("foreign-income", "2024-01-10", 1.01, ["Ingresos"]),
          direct("foreign-transfer", "2024-01-11", -1.01, ["Transferencia"]),
        ],
      },
    ],
  };
}

function withFilters(overrides: Partial<FilterState>): FilterState {
  const defaults = createDefaultFilterState();
  return {
    ...defaults,
    ...overrides,
    dateRange: overrides.dateRange ?? defaults.dateRange,
  };
}

test("normalizes static currencies and preserves My Expenses classification rules", () => {
  const dataset = normalizeDataset(fixtureSource());

  assert.equal(dataset.accounts.length, 3);
  assert.equal(dataset.postings.length, 12);
  assert.equal(dataset.minDate, "2024-01-01");
  assert.equal(dataset.maxDate, "2024-01-11");
  assert.equal(
    dataset.postings.find((posting) => posting.transactionId === "foreign-income")
      ?.amountEurMinor,
    126,
  );
  assert.equal(
    dataset.postings.find((posting) => posting.transactionId === "foreign-transfer")
      ?.amountEurMinor,
    -126,
  );
  assert.equal(
    dataset.postings.find((posting) => posting.transactionId === "expense")?.bucket,
    "expense",
  );
  assert.equal(
    dataset.postings.find((posting) => posting.transactionId === "transfer")?.bucket,
    "transfer",
  );
  assert.equal(
    dataset.postings.find((posting) => posting.transactionId === "negative-neutral")
      ?.bucket,
    "expense",
  );
  assert.equal(
    dataset.postings.find((posting) => posting.transactionId === "positive-neutral")
      ?.bucket,
    "income",
  );
  assert.equal(
    dataset.accounts.find((account) => account.id === "cash")
      ?.historicalBalanceEurMinor,
    20_800,
    "VOID must not affect account history",
  );
});

test("DYNAMIC accounts use historical equivalents and the static account fallback where My Expenses does", () => {
  const dynamicSource: AnalyticsSourceData = {
    accounts: {
      version: 2,
      accounts: {
        dynamic: {
          label: "Dynamic GBP",
          type: "DEFAULT",
          exchangeRateMode: "DYNAMIC",
        },
      },
    },
    categories,
    parsedData: [
      {
        uuid: "dynamic",
        label: "Dynamic GBP",
        currency: "GBP",
        openingBalance: 0,
        transactions: [
          direct("dynamic-posting", "2024-01-02", 1.01, ["Ingresos"]),
        ],
      },
    ],
  };
  const id = postingIdFor("dynamic", "dynamic-posting");

  assert.throws(
    () => normalizeDataset(dynamicSource),
    /DYNAMIC GBP\/EUR equivalent is unavailable/,
  );
  assert.equal(
    normalizeDataset(dynamicSource, {
      dynamicRates: { [dynamicRateKey("2024-01-02", "GBP")]: 1.25 },
      dynamicValuationEurMinorByAccountId: { dynamic: 126 },
    }).postings[0]?.amountEurMinor,
    126,
  );
  const exact = normalizeDataset(dynamicSource, {
    dynamicRates: { [dynamicRateKey("2024-01-02", "GBP")]: 1.25 },
    dynamicEurMinorByPostingId: { [id]: 127 },
    dynamicValuationEurMinorByAccountId: { dynamic: 127 },
  }).postings[0];
  assert.equal(exact?.amountEurMinor, 127);
  assert.equal(exact?.exchangeRateSource, "dynamic-equivalent");

  const dynamicSplitSource: AnalyticsSourceData = {
    ...dynamicSource,
    parsedData: [
      {
        ...dynamicSource.parsedData[0]!,
        transactions: [
          {
            uuid: "split-a",
            date: "2024-01-02",
            amount: 0.01,
            category: ["Ingresos"],
            sourceTransactionUuid: "split-parent",
            sourceStatus: "UNRECONCILED",
            splitIndex: 0,
            splitCount: 2,
            parent: { date: "2024-01-02", amount: 0.02 },
          },
          {
            uuid: "split-b",
            date: "2024-01-02",
            amount: 0.01,
            category: ["Ingresos"],
            sourceTransactionUuid: "split-parent",
            sourceStatus: "UNRECONCILED",
            splitIndex: 1,
            splitCount: 2,
            parent: { date: "2024-01-02", amount: 0.02 },
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    normalizeDataset(dynamicSplitSource, {
      dynamicRates: { [dynamicRateKey("2024-01-02", "GBP")]: 1.25 },
      dynamicValuationEurMinorByAccountId: { dynamic: 3 },
    }).postings.map((posting) => posting.amountEurMinor),
    [2, 2],
    "DYNAMIC splits are prorated from the rounded parent equivalent like My Expenses",
  );

  const linkedId = postingIdFor("dynamic", "linked-transfer");
  const linkedDynamicSource: AnalyticsSourceData = {
    ...dynamicSource,
    accounts: {
      version: 2,
      accounts: {
        dynamic: {
          ...dynamicSource.accounts.accounts.dynamic!,
          exchangeRateToEur: 1.2,
        },
      },
    },
    parsedData: [
      {
        ...dynamicSource.parsedData[0]!,
        transactions: [
          direct("linked-transfer", "2024-01-02", 1.01, ["Transferencia"], {
            transferAccount: "Cuenta EUR",
          }),
        ],
      },
    ],
  };
  const linked = normalizeDataset(linkedDynamicSource, {
    dynamicEurMinorByPostingId: { [linkedId]: 152 },
    dynamicRates: { [dynamicRateKey("2024-01-02", "GBP")]: 1.5 },
    dynamicValuationEurMinorByAccountId: { dynamic: 121 },
  }).postings[0];
  assert.equal(linked?.amountEurMinor, 121);
  assert.equal(linked?.exchangeRateToEur, 1.2);
  assert.equal(linked?.exchangeRateSource, "static");

  assert.throws(
    () =>
      normalizeDataset(
        {
          ...linkedDynamicSource,
          accounts: dynamicSource.accounts,
        },
        {
          dynamicEurMinorByPostingId: { [linkedId]: 152 },
          dynamicValuationEurMinorByAccountId: { dynamic: 121 },
        },
      ),
    /linked DYNAMIC posting requires account exchangeRateToEur/,
  );

  const nonZeroOpening = {
    ...dynamicSource,
    parsedData: [{ ...dynamicSource.parsedData[0]!, openingBalance: 10 }],
  };
  assert.throws(
    () =>
      normalizeDataset(nonZeroOpening, {
        dynamicEurMinorByPostingId: { [id]: 127 },
      }),
    /non-zero foreign opening balance requires account exchangeRateToEur/,
  );

  const openingWithStaticRate = normalizeDataset(
    {
      ...nonZeroOpening,
      accounts: {
        version: 2,
        accounts: {
          dynamic: {
            ...dynamicSource.accounts.accounts.dynamic!,
            exchangeRateToEur: 1.25,
          },
        },
      },
    },
    {
      dynamicEurMinorByPostingId: { [id]: 127 },
      dynamicValuationEurMinorByAccountId: { dynamic: 1_376 },
    },
  );
  assert.equal(openingWithStaticRate.accounts[0]?.openingBalanceEurMinor, 1_250);
});

test("global filters compose scope, period, category, status, tags, search and linkage", () => {
  const dataset = normalizeDataset(fixtureSource());
  const filtered = applyFilters(
    dataset,
    withFilters({
      scope: "realCashFlow",
      dateRange: { from: "2024-01-02", to: "2024-01-04" },
      accountIds: ["cash"],
      categoryPrefix: ["Gastos"],
      statuses: ["RECONCILED"],
      tags: ["Casa"],
      search: "devolucion CAFE",
      linked: "linked",
    }),
  );

  assert.deepEqual(
    filtered.postings.map((posting) => posting.transactionId),
    ["refund"],
  );
  assert.equal(aggregateKpis(filtered).netEurMinor, 200);
  assert.equal(
    filtered.periodOpeningBalanceEurMinor,
    9_000,
    "opening uses every prior non-VOID posting from the selected accounts",
  );

  const period = applyFilters(
    dataset,
    withFilters({ dateRange: { from: "2024-01-02", to: null } }),
  );
  assert.equal(
    period.periodOpeningBalanceEurMinor,
    11_000,
    "opening includes non-VOID flows before the selected period",
  );

  const voidOnly = applyFilters(dataset, withFilters({ statuses: ["VOID"] }));
  assert.equal(voidOnly.postings.length, 1);
  assert.equal(voidOnly.activePostings.length, 0);
  assert.equal(aggregateKpis(voidOnly).postingCount, 0);
  assert.equal(aggregateKpis(voidOnly).netEurMinor, 0);
});

test("KPIs expose net flows, gross/refunds/reversals and status counts in cents", () => {
  const filtered = applyFilters(
    normalizeDataset(fixtureSource()),
    createDefaultFilterState(),
  );
  const kpis = aggregateKpis(filtered);

  assert.deepEqual(
    {
      postingCount: kpis.postingCount,
      net: kpis.netEurMinor,
      expenses: kpis.expensesEurMinor,
      incomes: kpis.incomesEurMinor,
      transfers: kpis.transfersEurMinor,
      real: kpis.realCashFlowEurMinor,
      debt: kpis.debtFlowEurMinor,
      opening: kpis.periodOpeningBalanceEurMinor,
      closing: kpis.periodClosingBalanceEurMinor,
    },
    {
      postingCount: 11,
      net: 8_800,
      expenses: -3_100,
      incomes: 10_026,
      transfers: 1_874,
      real: 10_800,
      debt: -2_000,
      opening: 15_000,
      closing: 23_800,
    },
  );
  assert.deepEqual(
    {
      grossExpenses: kpis.grossExpensesEurMinor,
      refunds: kpis.expenseRefundsEurMinor,
      grossIncome: kpis.grossIncomeEurMinor,
      reversals: kpis.incomeReversalsEurMinor,
      transferInflows: kpis.transferInflowsEurMinor,
      transferOutflows: kpis.transferOutflowsEurMinor,
    },
    {
      grossExpenses: 4_300,
      refunds: 1_200,
      grossIncome: 10_526,
      reversals: 500,
      transferInflows: 2_000,
      transferOutflows: 126,
    },
  );
  assert.deepEqual(aggregateStatusCounts(filtered), {
    UNRECONCILED: { count: 10, amountEurMinor: 8_600 },
    CLEARED: { count: 0, amountEurMinor: 0 },
    RECONCILED: { count: 1, amountEurMinor: 200 },
    VOID: { count: 1, amountEurMinor: -99_900 },
  });
});

test("time series fill empty periods and use official start-year week boundaries", () => {
  const filtered = applyFilters(
    normalizeDataset(fixtureSource()),
    createDefaultFilterState(),
  );
  const days = aggregateTimeSeries(filtered, "day");
  assert.equal(days.length, 11);
  assert.equal(days[7]?.key, "2024-01-08");
  assert.equal(days[7]?.postingCount, 0, "a day containing only VOID is metric-empty");
  assert.deepEqual(
    aggregateTimeSeries(filtered, "week").map(({ key, postingCount }) => ({
      key,
      postingCount,
    })),
    [
      { key: "2024-W01", postingCount: 8 },
      { key: "2024-W02", postingCount: 3 },
    ],
  );

  const fullMonth = applyFilters(
    filtered.source,
    withFilters({ dateRange: { from: "2024-01-01", to: "2024-01-31" } }),
  );
  assert.equal(
    aggregateTimeSeries(fullMonth, "day").length,
    31,
    "explicit filter boundaries remain visible even after activity ends",
  );

  const boundarySource: AnalyticsSourceData = {
    accounts: {
      version: 2,
      accounts: { cash: { label: "Cash", type: "DEFAULT" } },
    },
    categories,
    parsedData: [
      {
        uuid: "cash",
        label: "Cash",
        currency: "EUR",
        openingBalance: 0,
        transactions: [
          direct("year-boundary", "2024-12-30", 1, ["Ingresos"]),
        ],
      },
    ],
  };
  const boundary = applyFilters(
    normalizeDataset(boundarySource),
    createDefaultFilterState(),
  );
  assert.equal(aggregateTimeSeries(boundary, "week")[0]?.key, "2024-W53");
  assert.deepEqual(
    aggregateTimeSeries(filtered, "month").map(({ key, postingCount }) => ({
      key,
      postingCount,
    })),
    [{ key: "2024-01", postingCount: 11 }],
  );
  assert.deepEqual(
    aggregateTimeSeries(filtered, "year").map(({ key, postingCount }) => ({
      key,
      postingCount,
    })),
    [{ key: "2024", postingCount: 11 }],
  );
});

test("time series honor backup week and month starts across year and leap boundaries", () => {
  const periodSource: AnalyticsSourceData = {
    accounts: {
      version: 2,
      accounts: { cash: { label: "Cash", type: "DEFAULT" } },
    },
    categories,
    parsedData: [
      {
        uuid: "cash",
        label: "Cash",
        currency: "EUR",
        openingBalance: 0,
        transactions: [
          direct("december-tuesday", "2024-12-31", 1, ["Ingresos"]),
          direct("new-year-wednesday", "2025-01-01", 1, ["Ingresos"]),
          direct("next-tuesday", "2025-01-07", 1, ["Ingresos"]),
          direct("next-wednesday", "2025-01-08", 1, ["Ingresos"]),
          direct("month-start", "2024-01-31", 1, ["Ingresos"]),
          direct("leap-end", "2024-02-29", 1, ["Ingresos"]),
          direct("march-boundary", "2024-03-31", 1, ["Ingresos"]),
        ],
      },
    ],
  };
  const source = withPeriodPreferences(normalizeDataset(periodSource), 31, 3);
  const weekly = aggregateTimeSeries(
    applyFilters(source, {
      ...createDefaultFilterState(),
      dateRange: { from: "2024-12-31", to: "2025-01-08" },
    }),
    "week",
  );
  assert.deepEqual(
    weekly.map(({ key, startDate, endDate, postingCount }) => ({
      key,
      startDate,
      endDate,
      postingCount,
    })),
    [
      {
        key: "2024-W52",
        startDate: "2024-12-25",
        endDate: "2024-12-31",
        postingCount: 1,
      },
      {
        key: "2025-W01",
        startDate: "2025-01-01",
        endDate: "2025-01-07",
        postingCount: 2,
      },
      {
        key: "2025-W02",
        startDate: "2025-01-08",
        endDate: "2025-01-14",
        postingCount: 1,
      },
    ],
  );

  const monthly = aggregateTimeSeries(
    applyFilters(source, {
      ...createDefaultFilterState(),
      dateRange: { from: "2024-01-31", to: "2024-04-30" },
    }),
    "month",
  );
  assert.deepEqual(
    monthly.map(({ key, startDate, endDate, postingCount }) => ({
      key,
      startDate,
      endDate,
      postingCount,
    })),
    [
      {
        key: "2024-01",
        startDate: "2024-01-31",
        endDate: "2024-02-29",
        postingCount: 2,
      },
      {
        key: "2024-02",
        startDate: "2024-03-01",
        endDate: "2024-03-30",
        postingCount: 0,
      },
      {
        key: "2024-03",
        startDate: "2024-03-31",
        endDate: "2024-04-30",
        postingCount: 1,
      },
    ],
  );
});

test("category, account and debt breakdowns reconcile to the filtered totals", () => {
  const filtered = applyFilters(
    normalizeDataset(fixtureSource()),
    createDefaultFilterState(),
  );
  const categoriesBreakdown = aggregateCategoryBreakdown(filtered);
  const expenses = categoriesBreakdown.find((category) => category.name === "Gastos");
  const neutral = categoriesBreakdown.find((category) => category.name === "Reajuste*");
  assert.equal(expenses?.summary.netEurMinor, -2_800);
  assert.equal(expenses?.directSummary.postingCount, 0);
  assert.equal(expenses?.children[0]?.categoryType, "EXPENSE");
  assert.equal(neutral?.summary.netEurMinor, 100);

  const accounts = aggregateAccountBreakdown(filtered);
  assert.equal(
    accounts.find((item) => item.account.id === "cash")
      ?.periodClosingBalanceEurMinor,
    20_800,
  );
  const debts = aggregateDebtBreakdown(filtered);
  assert.equal(debts.length, 1);
  assert.deepEqual(
    {
      closing: debts[0]?.periodClosingBalanceEurMinor,
      advances: debts[0]?.advancesEurMinor,
      recoveries: debts[0]?.recoveriesEurMinor,
      expenses: debts[0]?.grossDebtExpensesEurMinor,
      refunds: debts[0]?.debtExpenseRefundsEurMinor,
    },
    {
      closing: 3_000,
      advances: 3_000,
      recoveries: 1_000,
      expenses: 3_000,
      refunds: 1_000,
    },
  );
});

async function readOptionalJson(relativePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(
      await readFile(new URL(relativePath, import.meta.url), "utf8"),
    ) as unknown;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

test("current local backup dataset reproduces the official MyExpenses figures", async (context) => {
  const source = await readOptionalJson("../../data/app-dataset.json");
  if (source === undefined) {
    context.skip("Import a local backup to run the private-data golden test");
    return;
  }
  const dataset = normalizeDataset(source as AnalyticsInputData);
  const filtered = applyFilters(dataset, createDefaultFilterState());
  const kpis = aggregateKpis(filtered);

  assert.equal(dataset.accounts.length, 39);
  assert.equal(dataset.postings.length, 13_022);
  assert.equal(dataset.postings.filter((posting) => posting.isVoid).length, 4);
  assert.equal(dataset.backup?.categories.length, 81);
  assert.equal(dataset.backup?.budgets.length, 1);
  assert.equal(
    dataset.backup?.source.backupSha256,
    "ec6e298ea1075e089770ac678603500f5f71f8e5f894b190fda1e5f06e435ab4",
  );
  assert.equal(kpis.periodOpeningBalanceEurMinor, 3_921_091);
  assert.equal(kpis.incomesEurMinor, 8_763_405);
  assert.equal(kpis.expensesEurMinor, -5_001_652);
  assert.equal(kpis.transfersEurMinor, 182_096);
  assert.equal(kpis.periodClosingBalanceEurMinor, 7_864_940);
  assert.equal(
    dataset.accounts.reduce(
      (total, account) => total + account.valuationBalanceEurMinor,
      0,
    ),
    7_864_939,
    "account valuation reproduces the alternate official total",
  );
  const realCashFlow = aggregateKpis(
    applyFilters(
      dataset,
      withFilters({ scope: "realCashFlow" }),
    ),
  );
  const debtsOnly = aggregateKpis(
    applyFilters(dataset, withFilters({ scope: "debtsOnly" })),
  );
  assert.deepEqual(
    {
      opening: realCashFlow.periodOpeningBalanceEurMinor,
      flow: realCashFlow.netEurMinor,
      closing: realCashFlow.periodClosingBalanceEurMinor,
    },
    { opening: 1_567_029, flow: -1_154_919, closing: 412_110 },
  );
  assert.deepEqual(
    {
      opening: debtsOnly.periodOpeningBalanceEurMinor,
      flow: debtsOnly.netEurMinor,
      closing: debtsOnly.periodClosingBalanceEurMinor,
    },
    { opening: 2_354_062, flow: 5_098_768, closing: 7_452_830 },
  );
  const budget = dataset.backup?.budgets[0];
  assert.ok(budget !== undefined);
  const budgetResult = analyzeBudgetPeriod(dataset, filtered, budget);
  assert.equal(budgetResult.status, "ready");
  if (budgetResult.status === "ready") {
    assert.deepEqual(
      {
        period: budgetResult.analysis.period.key,
        assigned: budgetResult.analysis.global.assignedMinor,
        consumed: budgetResult.analysis.global.consumedMinor,
        available: budgetResult.analysis.global.availableMinor,
        postingCount: budgetResult.analysis.filteredPostingCount,
        allocationRows: flattenBudgetAllocationNodes(
          budgetResult.analysis.allocations,
        ).length,
        unallocated: budgetResult.analysis.unallocatedConsumedMinor,
      },
      {
        period: "MONTH:2026:7",
        assigned: 281_530,
        consumed: 234_036,
        available: 47_494,
        postingCount: 117,
        allocationRows: 33,
        unallocated: 0,
      },
    );
  }
});
