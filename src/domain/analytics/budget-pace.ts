import { budgetContributionsForPath, flattenBudgetAllocationNodes, type BudgetAnalysis, type BudgetContribution } from "./budgets.ts";
import type { IsoDate, NormalizedPosting } from "./types.ts";
import { assertIsoDate } from "./validation.ts";

export type BudgetPaceUnavailableReason =
  | "filtered-comparison"
  | "future-period"
  | "unsupported-grouping";

export type BudgetPaceAmount =
  | {
      readonly status: "ready";
      readonly assignedMinor: number;
      readonly expectedMinor: number;
      readonly actualToDateMinor: number;
      /** Positive means consumption is below the linear allowance. */
      readonly differenceMinor: number;
    }
  | { readonly status: "unavailable"; readonly reason: "non-positive-limit"; readonly assignedMinor: number };

export interface BudgetPaceBasis {
  readonly grouping: "MONTH" | "YEAR";
  readonly periodStartDate: IsoDate;
  readonly periodEndDate: IsoDate;
  readonly cutoffDate: IsoDate;
  readonly dateBasis: "operation" | "value";
  /** Days for MONTH; completed months plus a fractional current month for YEAR. */
  readonly elapsedUnits: number;
  readonly totalUnits: number;
  readonly fraction: number;
}

export type BudgetPaceResult =
  | {
      readonly status: "ready";
      readonly basis: BudgetPaceBasis;
      readonly currency: string;
      readonly fractionDigits: number;
      readonly global: BudgetPaceAmount;
      /** Inclusive ancestor consumption, matching each existing allocation node. */
      readonly categories: readonly (BudgetPaceAmount & {
        readonly categoryUuid: string;
        readonly path: readonly string[];
      })[];
    }
  | { readonly status: "unavailable"; readonly reason: BudgetPaceUnavailableReason };

function utcDayParts(year: number, monthIndex: number, day: number): number {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, monthIndex, day);
  return value.getTime() / 86_400_000;
}

function utcDay(date: IsoDate): number {
  return utcDayParts(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

function postingDate(posting: NormalizedPosting, dateBasis: BudgetPaceBasis["dateBasis"]): IsoDate {
  return dateBasis === "value" ? posting.valueDate ?? posting.date : posting.date;
}

function consumedThrough(
  contributions: readonly BudgetContribution[],
  cutoffDate: IsoDate,
  dateBasis: BudgetPaceBasis["dateBasis"],
): number {
  let result = 0;
  for (const { posting, amountMinor } of contributions) {
    if (postingDate(posting, dateBasis) > cutoffDate) continue;
    result += amountMinor;
    if (!Number.isSafeInteger(result)) throw new Error("Budget pace consumption exceeds safe minor units");
  }
  return result === 0 ? 0 : result;
}

function paceAmount(assignedMinor: number, actualToDateMinor: number, fraction: number): BudgetPaceAmount {
  if (assignedMinor <= 0) return { status: "unavailable", reason: "non-positive-limit", assignedMinor };
  const expectedMinor = assignedMinor * fraction;
  return {
    status: "ready", assignedMinor, expectedMinor, actualToDateMinor,
    differenceMinor: expectedMinor - actualToDateMinor,
  };
}

/** Linear allocation reference; never projects actual spending into the future. */
export function analyzeBudgetPace(analysis: BudgetAnalysis, today: IsoDate): BudgetPaceResult {
  assertIsoDate(today, "Budget pace today");
  const { period } = analysis;
  if (period.grouping !== "MONTH" && period.grouping !== "YEAR") {
    return { status: "unavailable", reason: "unsupported-grouping" };
  }
  if (today < period.startDate) return { status: "unavailable", reason: "future-period" };
  const cutoffDate = today > period.endDate ? period.endDate : today;
  const dateRange = analysis.consumptionDateRange;
  const dateWindowTruncated = dateRange === null || (dateRange !== undefined &&
    (dateRange.from > period.startDate || dateRange.to < cutoffDate));
  if ((analysis.isFilteredComparison && analysis.hasNonDateSubsetFilters !== false) ||
    dateWindowTruncated || (analysis.isFilteredComparison && dateRange === undefined)) {
    return { status: "unavailable", reason: "filtered-comparison" };
  }
  const dateBasis = analysis.dateBasis ?? "operation";
  let elapsedUnits: number;
  let totalUnits: number;
  if (period.grouping === "MONTH") {
    elapsedUnits = utcDay(cutoffDate) - utcDay(period.startDate) + 1;
    totalUnits = utcDay(period.endDate) - utcDay(period.startDate) + 1;
  } else {
    // YEAR periods are civil calendar years in the budget resolver.
    const monthIndex = Number(cutoffDate.slice(5, 7)) - 1;
    const year = Number(cutoffDate.slice(0, 4));
    const day = Number(cutoffDate.slice(8, 10));
    const monthLength = utcDayParts(year, monthIndex + 1, 1) - utcDayParts(year, monthIndex, 1);
    elapsedUnits = monthIndex + day / monthLength;
    totalUnits = 12;
  }
  const fraction = elapsedUnits / totalUnits;
  const global = paceAmount(analysis.global.assignedMinor,
    consumedThrough(analysis.contributions, cutoffDate, dateBasis), fraction);
  const categories = flattenBudgetAllocationNodes(analysis.allocations).map((node) => Object.assign(
    { categoryUuid: node.categoryUuid, path: node.path },
    paceAmount(node.assignedMinor,
      consumedThrough(budgetContributionsForPath(analysis.contributions, node.path), cutoffDate, dateBasis), fraction),
  ));
  return {
    status: "ready", currency: analysis.currency, fractionDigits: analysis.fractionDigits,
    basis: { grouping: period.grouping, periodStartDate: period.startDate, periodEndDate: period.endDate,
      cutoffDate, dateBasis, elapsedUnits, totalUnits, fraction },
    global, categories,
  };
}
