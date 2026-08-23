import { metricPostings } from "./filters.ts";
import {
  addIsoDays,
  monthPeriodForDate,
  weekPeriodForDate,
} from "./periods.ts";
import type {
  AccountBreakdownItem,
  AmountSummary,
  CategoryBreakdownNode,
  CategoryType,
  DebtBreakdownItem,
  FilteredAnalyticsDataset,
  FlowComposition,
  IsoDate,
  KpiSummary,
  NormalizedAccount,
  NormalizedPosting,
  StatusCounts,
  StatusSummary,
  TimeGranularity,
  TimeSeriesOptions,
  TimeSeriesPoint,
  TransactionStatus,
} from "./types.ts";

interface MutableAmountSummary {
  postingCount: number;
  netEurMinor: number;
  expensesEurMinor: number;
  incomesEurMinor: number;
  transfersEurMinor: number;
  realCashFlowEurMinor: number;
  debtFlowEurMinor: number;
}

interface MutableFlowComposition {
  grossExpensesEurMinor: number;
  expenseRefundsEurMinor: number;
  netExpensesEurMinor: number;
  grossIncomeEurMinor: number;
  incomeReversalsEurMinor: number;
  netIncomeEurMinor: number;
  transferInflowsEurMinor: number;
  transferOutflowsEurMinor: number;
  netTransfersEurMinor: number;
}

interface Period {
  readonly key: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
}

interface PeriodPreferences {
  readonly monthStart: number;
  readonly weekStart: number;
}

const DEFAULT_PERIOD_PREFERENCES: PeriodPreferences = {
  monthStart: 1,
  weekStart: 1,
};

interface MutableCategoryNode {
  readonly name: string;
  readonly path: readonly string[];
  readonly categoryType: CategoryType;
  readonly summary: MutableAmountSummary;
  readonly directSummary: MutableAmountSummary;
  readonly children: Map<string, MutableCategoryNode>;
  activityEurMinor: number;
}

function addMinor(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${context}: amount exceeds the safe integer range`);
  }
  return result === 0 ? 0 : result;
}

function createMutableSummary(): MutableAmountSummary {
  return {
    postingCount: 0,
    netEurMinor: 0,
    expensesEurMinor: 0,
    incomesEurMinor: 0,
    transfersEurMinor: 0,
    realCashFlowEurMinor: 0,
    debtFlowEurMinor: 0,
  };
}

function finalizeSummary(summary: MutableAmountSummary): AmountSummary {
  if (
    summary.netEurMinor !==
      summary.expensesEurMinor +
        summary.incomesEurMinor +
        summary.transfersEurMinor ||
    summary.netEurMinor !==
      summary.realCashFlowEurMinor + summary.debtFlowEurMinor
  ) {
    throw new Error("Amount-summary invariant failed");
  }
  return { ...summary };
}

function addPostingToSummary(
  summary: MutableAmountSummary,
  posting: NormalizedPosting,
): void {
  if (posting.isVoid) {
    return;
  }
  summary.postingCount += 1;
  summary.netEurMinor = addMinor(
    summary.netEurMinor,
    posting.amountEurMinor,
    "Net flow",
  );
  if (posting.bucket === "expense") {
    summary.expensesEurMinor = addMinor(
      summary.expensesEurMinor,
      posting.amountEurMinor,
      "Expense flow",
    );
  } else if (posting.bucket === "income") {
    summary.incomesEurMinor = addMinor(
      summary.incomesEurMinor,
      posting.amountEurMinor,
      "Income flow",
    );
  } else {
    summary.transfersEurMinor = addMinor(
      summary.transfersEurMinor,
      posting.amountEurMinor,
      "Transfer flow",
    );
  }
  if (posting.accountType === "DEBT") {
    summary.debtFlowEurMinor = addMinor(
      summary.debtFlowEurMinor,
      posting.amountEurMinor,
      "Debt flow",
    );
  } else {
    summary.realCashFlowEurMinor = addMinor(
      summary.realCashFlowEurMinor,
      posting.amountEurMinor,
      "Real cash flow",
    );
  }
}

function summarizePostings(
  postings: readonly NormalizedPosting[],
): AmountSummary {
  const summary = createMutableSummary();
  for (const posting of postings) {
    addPostingToSummary(summary, posting);
  }
  return finalizeSummary(summary);
}

function createMutableComposition(): MutableFlowComposition {
  return {
    grossExpensesEurMinor: 0,
    expenseRefundsEurMinor: 0,
    netExpensesEurMinor: 0,
    grossIncomeEurMinor: 0,
    incomeReversalsEurMinor: 0,
    netIncomeEurMinor: 0,
    transferInflowsEurMinor: 0,
    transferOutflowsEurMinor: 0,
    netTransfersEurMinor: 0,
  };
}

function addPostingToComposition(
  composition: MutableFlowComposition,
  posting: NormalizedPosting,
): void {
  if (posting.isVoid) {
    return;
  }
  const amount = posting.amountEurMinor;
  if (posting.bucket === "expense") {
    composition.netExpensesEurMinor = addMinor(
      composition.netExpensesEurMinor,
      amount,
      "Net expenses",
    );
    if (amount < 0) {
      composition.grossExpensesEurMinor = addMinor(
        composition.grossExpensesEurMinor,
        -amount,
        "Gross expenses",
      );
    } else {
      composition.expenseRefundsEurMinor = addMinor(
        composition.expenseRefundsEurMinor,
        amount,
        "Expense refunds",
      );
    }
  } else if (posting.bucket === "income") {
    composition.netIncomeEurMinor = addMinor(
      composition.netIncomeEurMinor,
      amount,
      "Net income",
    );
    if (amount < 0) {
      composition.incomeReversalsEurMinor = addMinor(
        composition.incomeReversalsEurMinor,
        -amount,
        "Income reversals",
      );
    } else {
      composition.grossIncomeEurMinor = addMinor(
        composition.grossIncomeEurMinor,
        amount,
        "Gross income",
      );
    }
  } else {
    composition.netTransfersEurMinor = addMinor(
      composition.netTransfersEurMinor,
      amount,
      "Net transfers",
    );
    if (amount < 0) {
      composition.transferOutflowsEurMinor = addMinor(
        composition.transferOutflowsEurMinor,
        -amount,
        "Transfer outflows",
      );
    } else {
      composition.transferInflowsEurMinor = addMinor(
        composition.transferInflowsEurMinor,
        amount,
        "Transfer inflows",
      );
    }
  }
}

export function aggregateFlowComposition(
  filtered: FilteredAnalyticsDataset,
): FlowComposition {
  const composition = createMutableComposition();
  for (const posting of metricPostings(filtered)) {
    addPostingToComposition(composition, posting);
  }
  return { ...composition };
}

export function aggregateKpis(
  filtered: FilteredAnalyticsDataset,
): KpiSummary {
  const summary = summarizePostings(metricPostings(filtered));
  const composition = aggregateFlowComposition(filtered);
  return {
    ...summary,
    ...composition,
    accountCount: filtered.accounts.length,
    periodOpeningBalanceEurMinor: filtered.periodOpeningBalanceEurMinor,
    periodClosingBalanceEurMinor: addMinor(
      filtered.periodOpeningBalanceEurMinor,
      summary.netEurMinor,
      "Filtered period closing balance",
    ),
  };
}

function emptyStatusSummary(): StatusSummary {
  return { count: 0, amountEurMinor: 0 };
}

export function aggregateStatusCounts(
  filtered: FilteredAnalyticsDataset,
): StatusCounts {
  const result: Record<TransactionStatus, StatusSummary> = {
    UNRECONCILED: emptyStatusSummary(),
    CLEARED: emptyStatusSummary(),
    RECONCILED: emptyStatusSummary(),
    VOID: emptyStatusSummary(),
  };
  for (const posting of filtered.postings) {
    const previous = result[posting.status];
    result[posting.status] = {
      count: previous.count + 1,
      amountEurMinor: addMinor(
        previous.amountEurMinor,
        posting.amountEurMinor,
        `${posting.status} amount`,
      ),
    };
  }
  return result;
}

function parseDateParts(date: IsoDate): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function periodFor(
  date: IsoDate,
  granularity: TimeGranularity,
  preferences: PeriodPreferences,
): Period {
  if (granularity === "day") {
    return { key: date, startDate: date, endDate: date };
  }
  if (granularity === "week") {
    return weekPeriodForDate(date, preferences.weekStart);
  }
  const { year } = parseDateParts(date);
  if (granularity === "month") {
    return monthPeriodForDate(date, preferences.monthStart);
  }
  const yearText = String(year).padStart(4, "0");
  return {
    key: yearText,
    startDate: `${yearText}-01-01` as IsoDate,
    endDate: `${yearText}-12-31` as IsoDate,
  };
}

function timePoint(period: Period, summary: MutableAmountSummary): TimeSeriesPoint {
  return { ...period, ...finalizeSummary(summary) };
}

export function aggregateTimeSeries(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  options: TimeSeriesOptions = {},
): readonly TimeSeriesPoint[] {
  if (
    granularity !== "day" &&
    granularity !== "week" &&
    granularity !== "month" &&
    granularity !== "year"
  ) {
    throw new Error(`Unknown time granularity ${JSON.stringify(granularity)}`);
  }
  const groups = new Map<string, { period: Period; summary: MutableAmountSummary }>();
  const periodByDate = new Map<IsoDate, Period>();
  const preferences =
    filtered.source.backup?.preferences ?? DEFAULT_PERIOD_PREFERENCES;
  for (const posting of metricPostings(filtered)) {
    let period = periodByDate.get(posting.date);
    if (period === undefined) {
      period = periodFor(posting.date, granularity, preferences);
      periodByDate.set(posting.date, period);
    }
    let group = groups.get(period.key);
    if (group === undefined) {
      group = { period, summary: createMutableSummary() };
      groups.set(period.key, group);
    }
    addPostingToSummary(group.summary, posting);
  }
  const ordered = [...groups.values()].sort((left, right) =>
    left.period.startDate.localeCompare(right.period.startDate),
  );
  if (options.fillGaps === false) {
    return ordered.map(({ period, summary }) => timePoint(period, summary));
  }

  const firstDate = filtered.filters.dateRange.from ?? ordered[0]?.period.startDate;
  const lastDate = filtered.filters.dateRange.to ?? ordered.at(-1)?.period.endDate;
  if (firstDate === undefined || lastDate === undefined) {
    return [];
  }
  const points: TimeSeriesPoint[] = [];
  let period = periodFor(firstDate, granularity, preferences);
  const lastPeriod = periodFor(lastDate, granularity, preferences);
  while (period.startDate <= lastPeriod.startDate) {
    const group = groups.get(period.key);
    points.push(timePoint(period, group?.summary ?? createMutableSummary()));
    period = periodFor(
      addIsoDays(period.endDate, 1),
      granularity,
      preferences,
    );
  }
  return points;
}

function createCategoryNode(
  name: string,
  path: readonly string[],
  categoryType: CategoryType,
): MutableCategoryNode {
  return {
    name,
    path,
    categoryType,
    summary: createMutableSummary(),
    directSummary: createMutableSummary(),
    children: new Map(),
    activityEurMinor: 0,
  };
}

function finalizeCategoryNode(node: MutableCategoryNode): CategoryBreakdownNode {
  const children = [...node.children.values()]
    .sort(
      (left, right) =>
        right.activityEurMinor - left.activityEurMinor ||
        left.name.localeCompare(right.name, "es"),
    )
    .map(finalizeCategoryNode);
  return {
    id: JSON.stringify(node.path),
    name: node.name,
    path: node.path,
    categoryType: node.categoryType,
    summary: finalizeSummary(node.summary),
    directSummary: finalizeSummary(node.directSummary),
    children,
  };
}

export function aggregateCategoryBreakdown(
  filtered: FilteredAnalyticsDataset,
): readonly CategoryBreakdownNode[] {
  const roots = new Map<string, MutableCategoryNode>();
  for (const posting of metricPostings(filtered)) {
    let level = roots;
    let current: MutableCategoryNode | undefined;
    const path: string[] = [];
    for (const name of posting.categoryPath) {
      path.push(name);
      current = level.get(name);
      if (current === undefined) {
        current = createCategoryNode(name, [...path], posting.categoryType);
        level.set(name, current);
      }
      addPostingToSummary(current.summary, posting);
      current.activityEurMinor = addMinor(
        current.activityEurMinor,
        Math.abs(posting.amountEurMinor),
        `Category ${JSON.stringify(path)}, activity`,
      );
      level = current.children;
    }
    if (current !== undefined) {
      addPostingToSummary(current.directSummary, posting);
    }
  }

  return [...roots.values()]
    .sort(
      (left, right) =>
        right.activityEurMinor - left.activityEurMinor ||
        left.name.localeCompare(right.name, "es"),
    )
    .map(finalizeCategoryNode);
}

function summariesByAccount(
  postings: readonly NormalizedPosting[],
): ReadonlyMap<string, MutableAmountSummary> {
  const result = new Map<string, MutableAmountSummary>();
  for (const posting of postings) {
    if (posting.isVoid) {
      continue;
    }
    let summary = result.get(posting.accountId);
    if (summary === undefined) {
      summary = createMutableSummary();
      result.set(posting.accountId, summary);
    }
    addPostingToSummary(summary, posting);
  }
  return result;
}

function accountItem(
  account: NormalizedAccount,
  filtered: FilteredAnalyticsDataset,
  summary: MutableAmountSummary | undefined,
): AccountBreakdownItem {
  const finalizedSummary = finalizeSummary(summary ?? createMutableSummary());
  const periodOpeningBalanceEurMinor =
    filtered.periodOpeningEurMinorByAccountId[account.id] ??
    account.openingBalanceEurMinor;
  return {
    account,
    ...finalizedSummary,
    periodOpeningBalanceEurMinor,
    periodClosingBalanceEurMinor: addMinor(
      periodOpeningBalanceEurMinor,
      finalizedSummary.netEurMinor,
      `Account ${account.id}, filtered period closing balance`,
    ),
  };
}

export function aggregateAccountBreakdown(
  filtered: FilteredAnalyticsDataset,
): readonly AccountBreakdownItem[] {
  const summaries = summariesByAccount(filtered.postings);
  return filtered.accounts
    .map((account) => accountItem(account, filtered, summaries.get(account.id)))
    .sort(
      (left, right) =>
        Math.abs(right.periodClosingBalanceEurMinor) -
          Math.abs(left.periodClosingBalanceEurMinor) ||
        left.account.label.localeCompare(right.account.label, "es"),
    );
}

export function aggregateDebtBreakdown(
  filtered: FilteredAnalyticsDataset,
): readonly DebtBreakdownItem[] {
  const summaries = summariesByAccount(filtered.postings);
  const postingsByAccount = new Map<string, NormalizedPosting[]>();
  for (const posting of metricPostings(filtered)) {
    if (posting.accountType !== "DEBT") {
      continue;
    }
    const accountPostings = postingsByAccount.get(posting.accountId);
    if (accountPostings === undefined) {
      postingsByAccount.set(posting.accountId, [posting]);
    } else {
      accountPostings.push(posting);
    }
  }

  return filtered.accounts
    .filter((account) => account.type === "DEBT")
    .map((account): DebtBreakdownItem => {
      const base = accountItem(account, filtered, summaries.get(account.id));
      let advancesEurMinor = 0;
      let recoveriesEurMinor = 0;
      let grossDebtExpensesEurMinor = 0;
      let debtExpenseRefundsEurMinor = 0;
      for (const posting of postingsByAccount.get(account.id) ?? []) {
        if (posting.amountEurMinor < 0) {
          advancesEurMinor = addMinor(
            advancesEurMinor,
            -posting.amountEurMinor,
            `Debt account ${account.id}, advances`,
          );
          if (posting.bucket === "expense") {
            grossDebtExpensesEurMinor = addMinor(
              grossDebtExpensesEurMinor,
              -posting.amountEurMinor,
              `Debt account ${account.id}, expenses`,
            );
          }
        } else {
          recoveriesEurMinor = addMinor(
            recoveriesEurMinor,
            posting.amountEurMinor,
            `Debt account ${account.id}, recoveries`,
          );
          if (posting.bucket === "expense") {
            debtExpenseRefundsEurMinor = addMinor(
              debtExpenseRefundsEurMinor,
              posting.amountEurMinor,
              `Debt account ${account.id}, expense refunds`,
            );
          }
        }
      }
      return Object.assign({}, base, {
        advancesEurMinor,
        recoveriesEurMinor,
        grossDebtExpensesEurMinor,
        debtExpenseRefundsEurMinor,
      });
    })
    .sort(
      (left, right) =>
        Math.abs(right.periodClosingBalanceEurMinor) -
          Math.abs(left.periodClosingBalanceEurMinor) ||
        left.account.label.localeCompare(right.account.label, "es"),
    );
}
