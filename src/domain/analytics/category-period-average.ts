import { aggregateCategoryBreakdown, aggregateTimeSeries } from "./aggregations.ts";
import { datasetDateBounds } from "./date-bounds.ts";
import { postingDate } from "./filters.ts";
import type {
  CategoryBreakdownNode,
  FilteredAnalyticsDataset,
  IsoDate,
  TimeGranularity,
} from "./types.ts";

export interface CategoryPeriodAverages {
  readonly completedPeriodCount: number;
  /** Categories without activity in completed periods are absent and average zero. */
  readonly averageEurMinorByCategoryId: ReadonlyMap<string, number>;
}

function collectAverages(
  nodes: readonly CategoryBreakdownNode[],
  divisor: number,
  result: Map<string, number>,
): void {
  for (const node of nodes) {
    result.set(node.id, node.summary.netEurMinor / divisor);
    collectAverages(node.children, divisor, result);
  }
}

/** The numerator and divisor use exactly the same fully completed units. */
export function aggregateCategoryPeriodAverages(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  today: IsoDate,
): CategoryPeriodAverages {
  const bounds = datasetDateBounds(filtered.source, filtered.filters.dateBasis);
  const from = filtered.filters.dateRange.from ?? bounds.minDate;
  const to = filtered.filters.dateRange.to ?? bounds.maxDate;
  const averages = new Map<string, number>();
  if (from === null || to === null || from > to) {
    return { completedPeriodCount: 0, averageEurMinorByCategoryId: averages };
  }
  const cappedTo = to < today ? to : today;
  if (from > cappedTo) {
    return { completedPeriodCount: 0, averageEurMinorByCategoryId: averages };
  }

  // Supplying the common range fills zero-activity units even when a category
  // has no posting there. Cap enumeration at today rather than padding a future
  // range; the returned period boundaries still respect backup preferences.
  const periods = aggregateTimeSeries({
    ...filtered,
    filters: { ...filtered.filters, dateRange: { from, to: cappedTo } },
  }, granularity).filter((period) =>
    period.startDate >= from && period.endDate <= to && period.endDate < today,
  );
  if (periods.length === 0) {
    return { completedPeriodCount: 0, averageEurMinorByCategoryId: averages };
  }

  const first = periods[0]!.startDate;
  const last = periods.at(-1)!.endDate;
  const completedPostings = filtered.activePostings.filter((posting) => {
    const date = postingDate(posting, filtered.filters);
    return date >= first && date <= last;
  });
  const completedCategories = aggregateCategoryBreakdown({
    ...filtered,
    activePostings: completedPostings,
  });
  collectAverages(completedCategories, periods.length, averages);
  return {
    completedPeriodCount: periods.length,
    averageEurMinorByCategoryId: averages,
  };
}
