import { aggregateTimeSeries } from "./aggregations.ts";
import { resolveBudgetAllocation, type BudgetAnalysis, type BudgetPeriod } from "./budgets.ts";
import { applyFilters, postingDate } from "./filters.ts";
import { resolvePostingAccounts } from "./transfer-relations.ts";
import type { AnalyticsDataset, FilterState, IsoDate, NormalizedPosting } from "./types.ts";
import { assertIsoDate } from "./validation.ts";

export interface AnnualProjectionPoint {
  readonly key: string;
  readonly month: number;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
  readonly kind: "actual" | "estimated";
  /** Actual eligible income for closed months; total expected income otherwise. */
  readonly incomeMinor: number;
  readonly observedIncomeEurMinor: number;
  readonly budgetMinor: number;
  readonly monthlyContributionEurMinor: number;
  readonly cumulativeEurMinor: number;
}

export type AnnualProjectionResult =
  | {
      readonly status: "ready";
      readonly year: number;
      readonly currency: "EUR";
      readonly fractionDigits: 2;
      /** The selected date window is replaced by the selected budget's full civil year. */
      readonly dateScope: "full-budget-calendar-year";
      readonly dateBasis: "operation" | "value";
      readonly coverage: { readonly from: IsoDate; readonly to: IsoDate };
      readonly income: {
        readonly basis: "same-year-complete-month-mean";
        readonly completeMonthCount: number;
        readonly completeMonthKeys: readonly string[];
        readonly totalMinor: number;
        /** Null when no estimate is needed. */
        readonly expectedMonthlyMinor: number | null;
      };
      readonly budget: {
        readonly grouping: "MONTH" | "YEAR";
        /** MONTH uses imported month labels, despite shifted accounting period dates. */
        readonly distribution: "per-calendar-month-label" | "even-calendar-months";
        readonly annualBudgetMinor: number;
      };
      readonly points: readonly AnnualProjectionPoint[];
    }
  | {
      readonly status: "unavailable";
      readonly reason: "unsupported-grouping" | "unsupported-budget-scope" | "incompatible-currency" |
        "filtered-scope" | "invalid-period" | "no-complete-months";
    };

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("Annual projection exceeds safe EUR minor units");
  return result === 0 ? 0 : result;
}

function civilMonth(year: number, index: number) {
  const label = String(index + 1).padStart(2, "0");
  const startDate = `${String(year).padStart(4, "0")}-${label}-01` as IsoDate;
  const end = new Date(0);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCFullYear(year, index + 1, 0);
  const endDate = `${String(year).padStart(4, "0")}-${label}-${String(end.getUTCDate()).padStart(2, "0")}` as IsoDate;
  return { key: `${String(year).padStart(4, "0")}-${label}`, startDate, endDate };
}

function hasContentSubset(filters: FilterState): boolean {
  return filters.scope === "debtsOnly" || filters.accountIds.length > 0 ||
    (filters.originAccountIds?.length ?? 0) > 0 || (filters.destinationAccountIds?.length ?? 0) > 0 ||
    filters.categoryPrefixes.length > 0 || filters.statuses.length > 0 || filters.tags.length > 0 ||
    filters.search !== "" || filters.linked !== "all" ||
    (filters.payeeKeys?.length ?? 0) > 0 || (filters.paymentMethodKeys?.length ?? 0) > 0 ||
    (filters.categoryTypes?.length ?? 0) > 0 || (filters.currencies?.length ?? 0) > 0 ||
    filters.minAmountEurMinor != null || filters.maxAmountEurMinor != null ||
    (filters.commentSearch ?? "") !== "" || (filters.referenceSearch ?? "") !== "";
}

/** Signed income-category activity, excluding recorded internal and debt transfers. */
function isReceivedIncome(posting: NormalizedPosting, dataset: AnalyticsDataset): boolean {
  if (posting.bucket !== "income" || posting.categoryType !== "INCOME") return false;
  const { peer } = resolvePostingAccounts(posting, dataset);
  return peer === undefined || peer.isVoid;
}

/** Civil Jan–Dec net flow since January, not an opening account balance. */
export function analyzeAnnualSavingsProjection(
  analytics: AnalyticsDataset,
  analysis: BudgetAnalysis,
  filters: FilterState,
  options: { readonly today: IsoDate },
): AnnualProjectionResult {
  assertIsoDate(options.today, "Annual projection today");
  const { budget, period } = analysis;
  if (period.grouping !== "MONTH" && period.grouping !== "YEAR") {
    return { status: "unavailable", reason: "unsupported-grouping" };
  }
  if (budget.accountUuid !== null || budget.filter !== null) {
    return { status: "unavailable", reason: "unsupported-budget-scope" };
  }
  if (analysis.currency !== "EUR" || analysis.fractionDigits !== 2 || analytics.backup?.preferences.homeCurrency !== "EUR") {
    return { status: "unavailable", reason: "incompatible-currency" };
  }
  if (hasContentSubset(filters)) return { status: "unavailable", reason: "filtered-scope" };
  const year = period.year;
  if (year === null || !Number.isInteger(year) || year < 1 || year > 9999 || period.grouping !== budget.grouping) {
    return { status: "unavailable", reason: "invalid-period" };
  }

  const months = Array.from({ length: 12 }, (_, index) => civilMonth(year, index));
  const realFilters: FilterState = {
    ...filters, scope: "realCashFlow", periodMode: "year",
    dateRange: { from: months[0]!.startDate, to: months[11]!.endDate },
  };
  const real = applyFilters(analytics, realFilters);
  // Include today's recorded activity; only future-dated postings are excluded.
  const historical = { ...real, activePostings: real.activePostings.filter((row) => postingDate(row, real.filters) <= options.today) };
  const flowByMonth = new Map(aggregateTimeSeries(historical, "month", { monthStart: 1 })
    .map((point) => [point.key, point.realCashFlowEurMinor]));
  const incomeByMonth = new Map<string, number>();
  for (const row of historical.activePostings) {
    if (!isReceivedIncome(row, analytics)) continue;
    const key = postingDate(row, real.filters).slice(0, 7);
    incomeByMonth.set(key, safeAdd(incomeByMonth.get(key) ?? 0, row.amountEurMinor));
  }

  const includedAccounts = new Set(analytics.accounts.filter((account) => account.includedInAll !== false).map((account) => account.id));
  let from: IsoDate | null = null;
  let to: IsoDate | null = null;
  for (const row of analytics.postings) {
    if (row.isVoid || !includedAccounts.has(row.accountId)) continue;
    const date = postingDate(row, real.filters);
    if (date > options.today) continue;
    if (from === null || date < from) from = date;
    if (to === null || date > to) to = date;
  }
  const completeKeys = months.filter((month) => from !== null && to !== null &&
    month.startDate >= from && month.endDate <= to && month.endDate < options.today).map((month) => month.key);
  const completeSet = new Set(completeKeys);
  const needsEstimate = completeKeys.length < 12;
  if (needsEstimate && completeKeys.length === 0 || from === null || to === null) {
    return { status: "unavailable", reason: "no-complete-months" };
  }
  let incomeTotal = 0;
  for (const key of completeKeys) incomeTotal = safeAdd(incomeTotal, incomeByMonth.get(key) ?? 0);
  const expectedMonthlyMinor = needsEstimate ? Math.round(incomeTotal / completeKeys.length) : null;
  if (expectedMonthlyMinor !== null && !Number.isSafeInteger(expectedMonthlyMinor)) {
    throw new Error("Annual income mean exceeds safe EUR minor units");
  }

  const globalAllocations = budget.allocations.filter((entry) => entry.categoryUuid === null);
  let annualBudget = 0;
  let annualBase = 0;
  let annualRemainder = 0;
  if (budget.grouping === "YEAR") {
    annualBudget = resolveBudgetAllocation(globalAllocations, period).totalMinor;
    annualBase = Math.trunc(annualBudget / 12);
    annualRemainder = annualBudget % 12;
  }
  let cumulative = 0;
  const points: AnnualProjectionPoint[] = months.map((month, index) => {
    let budgetMinor: number;
    if (budget.grouping === "YEAR") {
      budgetMinor = annualBase + (index < Math.abs(annualRemainder) ? Math.sign(annualRemainder) : 0);
    } else {
      // The allocation key labels a civil month even if the imported period starts mid-month.
      const labelPeriod: BudgetPeriod = {
        key: `MONTH:${year}:${index}`, grouping: "MONTH", year, second: index,
        startDate: month.startDate, endDate: month.endDate, label: month.key,
      };
      budgetMinor = resolveBudgetAllocation(globalAllocations, labelPeriod).totalMinor;
      annualBudget = safeAdd(annualBudget, budgetMinor);
    }
    const observedIncomeEurMinor = incomeByMonth.get(month.key) ?? 0;
    const actual = completeSet.has(month.key);
    const incomeMinor = actual ? observedIncomeEurMinor : incomeByMonth.has(month.key)
      ? Math.max(expectedMonthlyMinor!, observedIncomeEurMinor) : expectedMonthlyMinor!;
    const monthlyContributionEurMinor = actual ? flowByMonth.get(month.key) ?? 0 : safeAdd(incomeMinor, -budgetMinor);
    cumulative = safeAdd(cumulative, monthlyContributionEurMinor);
    return { key: month.key, startDate: month.startDate, endDate: month.endDate,
      month: index + 1, kind: actual ? "actual" : "estimated",
      incomeMinor, observedIncomeEurMinor, budgetMinor, monthlyContributionEurMinor, cumulativeEurMinor: cumulative };
  });
  return {
    status: "ready", year, currency: "EUR", fractionDigits: 2,
    dateScope: "full-budget-calendar-year", dateBasis: real.filters.dateBasis ?? "operation", coverage: { from, to },
    income: { basis: "same-year-complete-month-mean", completeMonthCount: completeKeys.length,
      completeMonthKeys: completeKeys, totalMinor: incomeTotal, expectedMonthlyMinor },
    budget: { grouping: budget.grouping, distribution: budget.grouping === "YEAR" ? "even-calendar-months" : "per-calendar-month-label",
      annualBudgetMinor: annualBudget },
    points,
  };
}
