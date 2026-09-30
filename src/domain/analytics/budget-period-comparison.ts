import type { BackupBudgetGrouping } from "./backup-dataset.types.ts";
import {
  budgetPeriodForDate,
  collectBudgetScopedActivity,
  flattenBudgetAllocationNodes,
  type BudgetAnalysis,
  type BudgetContribution,
  type BudgetPeriod,
} from "./budgets.ts";
import { applyFilters, postingDate } from "./filters.ts";
import { addIsoDays } from "./periods.ts";
import type { AnalyticsDataset, FilterState, IsoDate } from "./types.ts";
import { assertIsoDate } from "./validation.ts";

export interface BudgetReferenceRange {
  readonly key: string;
  readonly label: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
}

export interface BudgetComparisonOptions {
  readonly today: IsoDate;
  /** Omitted: preceding compatible calendar period. Empty: no references. */
  readonly references?: readonly BudgetReferenceRange[];
  readonly primaryReferenceKey?: string;
}

export interface BudgetReference {
  readonly status: "complete" | "unavailable";
  readonly reason: "outside-coverage" | "not-yet-complete" | null;
  readonly range: BudgetReferenceRange;
  readonly consumedMinor: number | null;
  readonly incomeMinor: number | null;
  readonly deltaMinor: number | null;
  readonly percentChange: number | null;
}

export interface BudgetAmountComparison {
  readonly referenceKey: string;
  readonly amountMinor: number | null;
  readonly deltaMinor: number | null;
  readonly percentChange: number | null;
}

export interface BudgetCategoryComparison {
  readonly categoryUuid: string;
  readonly name: string;
  readonly path: readonly string[];
  readonly currentConsumedMinor: number;
  readonly references: readonly (BudgetAmountComparison & { readonly consumedMinor: number | null })[];
  readonly mean: { readonly averageMinor: number | null; readonly deltaMinor: number | null; readonly percentChange: number | null };
}

export interface BudgetPeriodMean {
  readonly status: "ready" | "no-complete-history" | "unsupported-grouping";
  readonly reason: "no-complete-history" | "custom-range-has-no-calendar-unit" | null;
  readonly unit: BackupBudgetGrouping | null;
  readonly periodCount: number;
  readonly periods: readonly BudgetPeriod[];
  readonly firstDate: IsoDate | null;
  readonly lastDate: IsoDate | null;
  readonly consumedTotalMinor: number | null;
  readonly consumedAverageMinor: number | null;
  readonly incomeTotalMinor: number | null;
  readonly incomeAverageMinor: number | null;
}

export interface BudgetPeriodComparison {
  readonly budgetUuid: string;
  readonly targetPeriod: BudgetPeriod;
  readonly currency: string;
  readonly fractionDigits: number;
  /** Dataset-wide bounds before non-date filters; empty filtered periods still count. */
  readonly coverage: { readonly from: IsoDate; readonly to: IsoDate } | null;
  readonly primaryReferenceKey: string | null;
  readonly references: readonly BudgetReference[];
  readonly categories: readonly BudgetCategoryComparison[];
  readonly mean: BudgetPeriodMean;
  /** Signed income-category postings in the same account/currency/filter scope. */
  readonly income: {
    readonly scope: "income-category-postings";
    readonly currentMinor: number;
    readonly references: readonly BudgetAmountComparison[];
    readonly mean: { readonly averageMinor: number | null; readonly deltaMinor: number | null; readonly percentChange: number | null };
  };
}

export type BudgetPeriodComparisonResult =
  | { readonly status: "ready"; readonly comparison: BudgetPeriodComparison }
  | { readonly status: "unsupported"; readonly reason: string };

interface Bucket {
  consumption: number;
  income: number;
  categories: Map<string, number>;
}

function emptyBucket(): Bucket {
  return { consumption: 0, income: 0, categories: new Map() };
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("Budget comparison exceeds safe minor units");
  return result === 0 ? 0 : result;
}

function addBucket(target: Bucket, source: Bucket): void {
  target.consumption = safeAdd(target.consumption, source.consumption);
  target.income = safeAdd(target.income, source.income);
  for (const [uuid, amount] of source.categories) {
    target.categories.set(uuid, safeAdd(target.categories.get(uuid) ?? 0, amount));
  }
}

function comparison(current: number, baseline: number | null) {
  const deltaMinor = baseline === null ? null : current - baseline;
  return {
    deltaMinor,
    percentChange: baseline === null || baseline === 0 ? null : deltaMinor! / Math.abs(baseline) * 100,
  };
}

function datasetCoverage(
  analytics: AnalyticsDataset,
  filters: FilterState,
): BudgetPeriodComparison["coverage"] {
  let from: IsoDate | null = null;
  let to: IsoDate | null = null;
  for (const posting of analytics.postings) {
    const date = postingDate(posting, filters);
    if (from === null || date < from) from = date;
    if (to === null || date > to) to = date;
  }
  return from === null || to === null ? null : { from, to };
}

function validateReferences(
  references: readonly BudgetReferenceRange[],
  primaryKey: string | undefined,
): string | null {
  const keys = new Set<string>();
  for (const range of references) {
    assertIsoDate(range.startDate, "Budget reference start");
    assertIsoDate(range.endDate, "Budget reference end");
    if (range.startDate > range.endDate) return `Reference ${range.key} has reversed dates.`;
    if (range.key === "" || keys.has(range.key)) return `Reference key ${range.key} is empty or duplicated.`;
    keys.add(range.key);
  }
  if (primaryKey !== undefined && !keys.has(primaryKey)) return `Primary reference ${primaryKey} is not selected.`;
  return null;
}

/** Compares spending without requiring historical budget allocation records. */
export function analyzeBudgetPeriodComparison(
  analytics: AnalyticsDataset,
  analysis: BudgetAnalysis,
  filters: FilterState,
  options: BudgetComparisonOptions,
): BudgetPeriodComparisonResult {
  const backup = analytics.backup;
  if (backup === undefined) return { status: "unsupported", reason: "The dataset has no budget metadata." };
  assertIsoDate(options.today, "Comparison today");
  const previous = analysis.period.grouping === "NONE" ? null :
    budgetPeriodForDate(analysis.period.grouping, addIsoDays(analysis.period.startDate, -1), backup.preferences);
  const ranges = options.references ?? (previous === null ? [] : [previous]);
  const referenceError = validateReferences(ranges, options.primaryReferenceKey);
  if (referenceError !== null) return { status: "unsupported", reason: referenceError };
  const primaryReferenceKey = options.primaryReferenceKey ?? ranges[0]?.key ?? null;

  // The selected date cut belongs only to the current analysis. Keep every other
  // global filter, including statuses:[] and the chosen date basis, for history.
  const historicalFilters: FilterState = {
    ...filters,
    periodMode: "all",
    dateRange: { from: null, to: null },
  };
  const filtered = applyFilters(analytics, historicalFilters);
  const activity = collectBudgetScopedActivity(analytics, filtered, analysis.budget);
  if ("reason" in activity) return { status: "unsupported", reason: activity.reason };
  if (activity.currency !== analysis.currency || activity.fractionDigits !== analysis.fractionDigits) {
    return { status: "unsupported", reason: "Budget analysis currency differs from the dataset." };
  }

  const coverage = datasetCoverage(analytics, historicalFilters);
  const categories = flattenBudgetAllocationNodes(analysis.allocations);
  const categoryByPath = new Map(categories.map((node) => [JSON.stringify(node.path), node.categoryUuid]));
  const days = new Map<IsoDate, Bucket>();
  const dayBucket = (date: IsoDate): Bucket => {
    let bucket = days.get(date);
    if (bucket === undefined) {
      bucket = emptyBucket();
      days.set(date, bucket);
    }
    return bucket;
  };
  const addActivity = (entries: readonly BudgetContribution[], kind: "consumption" | "income") => {
    for (const { posting, amountMinor } of entries) {
      const bucket = dayBucket(postingDate(posting, historicalFilters));
      bucket[kind] = safeAdd(bucket[kind], amountMinor);
      if (kind === "consumption") {
        for (let length = 1; length <= posting.categoryPath.length; length += 1) {
          const uuid = categoryByPath.get(JSON.stringify(posting.categoryPath.slice(0, length)));
          if (uuid !== undefined) {
            bucket.categories.set(uuid, safeAdd(bucket.categories.get(uuid) ?? 0, amountMinor));
          }
        }
      }
    }
  };
  addActivity(activity.consumption, "consumption");
  addActivity(activity.income, "income");

  const calendarBuckets = new Map<string, Bucket>();
  if (analysis.period.grouping !== "NONE") {
    for (const [date, bucket] of days) {
      const period = budgetPeriodForDate(analysis.period.grouping, date, backup.preferences);
      if (period === null) continue;
      let aggregate = calendarBuckets.get(period.key);
      if (aggregate === undefined) {
        aggregate = emptyBucket();
        calendarBuckets.set(period.key, aggregate);
      }
      addBucket(aggregate, bucket);
    }
  }

  const sumRange = (from: IsoDate, to: IsoDate): Bucket => {
    const total = emptyBucket();
    for (const [date, bucket] of days) {
      if (date >= from && date <= to) addBucket(total, bucket);
    }
    return total;
  };
  const referenceBuckets = ranges.map((range) => {
    const reason: BudgetReference["reason"] = range.endDate >= options.today ? "not-yet-complete" :
      coverage === null || range.startDate < coverage.from || range.endDate > coverage.to ? "outside-coverage" : null;
    return { range, reason, bucket: reason === null ? sumRange(range.startDate, range.endDate) : null };
  });
  const references: BudgetReference[] = referenceBuckets.map(({ range, reason, bucket }) => {
    const consumedMinor = bucket?.consumption ?? null;
    const compared = comparison(analysis.global.consumedMinor, consumedMinor);
    return {
      range,
      status: bucket === null ? "unavailable" : "complete",
      reason,
      consumedMinor,
      incomeMinor: bucket?.income ?? null,
      deltaMinor: compared.deltaMinor,
      percentChange: compared.percentChange,
    };
  });

  const historicalPeriods: BudgetPeriod[] = [];
  if (coverage !== null && analysis.period.grouping !== "NONE") {
    let cursor = addIsoDays(analysis.period.startDate, -1);
    while (cursor >= coverage.from) {
      const period = budgetPeriodForDate(analysis.period.grouping, cursor, backup.preferences);
      if (period === null || period.startDate < coverage.from) break;
      if (period.endDate <= coverage.to && period.endDate < options.today) historicalPeriods.push(period);
      cursor = addIsoDays(period.startDate, -1);
    }
    historicalPeriods.reverse();
  }
  const meanBucket = emptyBucket();
  for (const period of historicalPeriods) {
    const aggregate = calendarBuckets.get(period.key);
    if (aggregate !== undefined) addBucket(meanBucket, aggregate);
  }
  const meanStatus = analysis.period.grouping === "NONE" ? "unsupported-grouping" :
    historicalPeriods.length === 0 ? "no-complete-history" : "ready";
  const count = historicalPeriods.length;
  const mean: BudgetPeriodMean = {
    status: meanStatus,
    reason: meanStatus === "ready" ? null : meanStatus === "unsupported-grouping" ? "custom-range-has-no-calendar-unit" : "no-complete-history",
    unit: analysis.period.grouping === "NONE" ? null : analysis.period.grouping,
    periodCount: count,
    periods: historicalPeriods,
    firstDate: historicalPeriods[0]?.startDate ?? null,
    lastDate: historicalPeriods.at(-1)?.endDate ?? null,
    consumedTotalMinor: count > 0 ? meanBucket.consumption : null,
    consumedAverageMinor: count > 0 ? meanBucket.consumption / count : null,
    incomeTotalMinor: count > 0 ? meanBucket.income : null,
    incomeAverageMinor: count > 0 ? meanBucket.income / count : null,
  };

  const categoryComparisons: BudgetCategoryComparison[] = categories.map((node) => {
    const meanAmount = count > 0 ? (meanBucket.categories.get(node.categoryUuid) ?? 0) / count : null;
    return {
      categoryUuid: node.categoryUuid,
      name: node.name,
      path: node.path,
      currentConsumedMinor: node.consumedMinor,
      references: referenceBuckets.map(({ range, bucket }) => {
        const consumedMinor = bucket === null ? null : bucket.categories.get(node.categoryUuid) ?? 0;
        const compared = comparison(node.consumedMinor, consumedMinor);
        return { referenceKey: range.key, consumedMinor, amountMinor: consumedMinor,
          deltaMinor: compared.deltaMinor, percentChange: compared.percentChange };
      }),
      mean: { averageMinor: meanAmount, ...comparison(node.consumedMinor, meanAmount) },
    };
  });
  const currentRange = analysis.consumptionDateRange;
  const currentIncome = currentRange === null ? 0 :
    currentRange === undefined ? sumRange(analysis.period.startDate, analysis.period.endDate).income :
      sumRange(currentRange.from, currentRange.to).income;
  const incomeMean = mean.incomeAverageMinor;
  return {
    status: "ready",
    comparison: {
      budgetUuid: analysis.budget.uuid,
      targetPeriod: analysis.period,
      currency: activity.currency,
      fractionDigits: activity.fractionDigits,
      coverage,
      primaryReferenceKey,
      references,
      categories: categoryComparisons,
      mean,
      income: {
        scope: "income-category-postings",
        currentMinor: currentIncome,
        references: referenceBuckets.map(({ range, bucket }) => {
          const amountMinor = bucket?.income ?? null;
          const compared = comparison(currentIncome, amountMinor);
          return { referenceKey: range.key, amountMinor,
            deltaMinor: compared.deltaMinor, percentChange: compared.percentChange };
        }),
        mean: { averageMinor: incomeMean, ...comparison(currentIncome, incomeMean) },
      },
    },
  };
}
