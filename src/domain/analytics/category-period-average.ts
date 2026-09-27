import { aggregateCategoryBreakdown, aggregateTimeSeries } from "./aggregations.ts";
import { datasetDateBounds } from "./date-bounds.ts";
import { applyFilters, postingDate } from "./filters.ts";
import type {
  CategoryBreakdownNode,
  FilteredAnalyticsDataset,
  IsoDate,
  TimeGranularity,
  TimeSeriesPoint,
} from "./types.ts";

export interface AveragePeriodWindow {
  /** Evaluated range; open ends use the common dataset bounds. */
  readonly from: IsoDate | null;
  readonly to: IsoDate | null;
  /** First and last fully completed units; zero-activity units between them count. */
  readonly includedWindow: { readonly from: IsoDate; readonly to: IsoDate } | null;
  readonly completedPeriodCount: number;
  /** Only intersecting edge/current units; future units are not enumerated. */
  readonly excludedPeriods: readonly {
    readonly from: IsoDate;
    readonly to: IsoDate;
    readonly reasons: readonly ("startsBeforeRange" | "endsAfterRange" | "currentOrFuture")[];
  }[];
  readonly futureExcluded: boolean;
}

export interface CategoryPeriodAverages {
  readonly scope: "filtered" | "historical";
  readonly completedPeriodCount: number;
  /** Categories without activity in completed periods are absent and average zero. */
  readonly averageEurMinorByCategoryId: ReadonlyMap<string, number>;
  readonly selectedWindow: AveragePeriodWindow;
  readonly appliedWindow: AveragePeriodWindow;
  readonly fallbackReason: "selectedPeriodNeedsHistory" | "noCompleteFilteredUnits" | null;
}

interface WindowSelection {
  readonly window: AveragePeriodWindow;
  readonly completed: readonly TimeSeriesPoint[];
}

function selectWindow(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  today: IsoDate,
): WindowSelection {
  const bounds = datasetDateBounds(filtered.source, filtered.filters.dateBasis);
  const from = filtered.filters.dateRange.from ?? bounds.minDate;
  const to = filtered.filters.dateRange.to ?? bounds.maxDate;
  const empty = (): WindowSelection => ({
    window: { from, to, includedWindow: null, completedPeriodCount: 0,
      excludedPeriods: [], futureExcluded: to !== null && to > today },
    completed: [],
  });
  if (from === null || to === null || from > to) return empty();
  const cappedTo = to < today ? to : today;
  if (from > cappedTo) return empty();

  // Use exactly the same calendar candidates and completeness predicate as
  // the numerator/divisor; only intersecting edge/current units are reported.
  const candidates = aggregateTimeSeries({
    ...filtered,
    filters: { ...filtered.filters, dateRange: { from, to: cappedTo } },
  }, granularity);
  const completed: TimeSeriesPoint[] = [];
  const excludedPeriods: AveragePeriodWindow["excludedPeriods"][number][] = [];
  for (const period of candidates) {
    const reasons: ("startsBeforeRange" | "endsAfterRange" | "currentOrFuture")[] = [];
    if (period.startDate < from) reasons.push("startsBeforeRange");
    if (period.endDate > to) reasons.push("endsAfterRange");
    if (period.endDate >= today) reasons.push("currentOrFuture");
    if (reasons.length === 0) completed.push(period);
    else excludedPeriods.push({ from: period.startDate, to: period.endDate, reasons });
  }
  return {
    window: {
      from, to,
      includedWindow: completed.length === 0 ? null : {
        from: completed[0]!.startDate,
        to: completed.at(-1)!.endDate,
      },
      completedPeriodCount: completed.length,
      excludedPeriods,
      futureExcluded: to > today,
    },
    completed,
  };
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
function averagesWithinRange(
  filtered: FilteredAnalyticsDataset,
  selection: WindowSelection,
  scope: CategoryPeriodAverages["scope"],
  selectedWindow: AveragePeriodWindow,
  fallbackReason: CategoryPeriodAverages["fallbackReason"],
): CategoryPeriodAverages {
  const averages = new Map<string, number>();
  const { completed: periods, window } = selection;
  if (periods.length === 0) return { scope, completedPeriodCount: 0,
    averageEurMinorByCategoryId: averages, selectedWindow, appliedWindow: window, fallbackReason };

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
    scope,
    completedPeriodCount: periods.length,
    averageEurMinorByCategoryId: averages,
    selectedWindow,
    appliedWindow: window,
    fallbackReason,
  };
}

const GRANULARITY_RANK: Readonly<Record<TimeGranularity, number>> = {
  day: 0,
  week: 1,
  month: 2,
  year: 3,
};

export function aggregateCategoryPeriodAverages(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  today: IsoDate,
): CategoryPeriodAverages {
  const mode = filtered.filters.periodMode;
  const useHistory = mode !== "all" && mode !== "custom" &&
    GRANULARITY_RANK[granularity] >= GRANULARITY_RANK[mode];
  const selected = selectWindow(filtered, granularity, today);
  if (!useHistory && selected.completed.length > 0)
    return averagesWithinRange(filtered, selected, "filtered", selected.window, null);

  // Keep every non-date filter (and the caller's category scope) intact. The
  // original dataset's common bounds, not category activity, limit history.
  const historical = applyFilters(filtered.source, {
    ...filtered.filters,
    periodMode: "all",
    dateRange: { from: null, to: null },
  });
  return averagesWithinRange(historical, selectWindow(historical, granularity, today),
    "historical", selected.window,
    useHistory ? "selectedPeriodNeedsHistory" : "noCompleteFilteredUnits");
}
