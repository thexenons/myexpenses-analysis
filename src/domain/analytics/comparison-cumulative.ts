import { aggregateTimeSeries } from "./aggregations.ts";
import type { ComparisonDateRange, PeriodComparisonResult } from "./comparison.ts";
import { applyFilters } from "./filters.ts";
import { addIsoDays } from "./periods.ts";
import type { FilteredAnalyticsDataset, IsoDate, TimeSeriesPoint } from "./types.ts";

export type CumulativeComparisonMetric = "expenses" | "income" | "net";

export interface CumulativeComparisonPoint {
  readonly day: number;
  readonly date: IsoDate;
  readonly eurMinor: number;
}

export interface CumulativeComparison {
  readonly current: readonly CumulativeComparisonPoint[];
  readonly reference: readonly CumulativeComparisonPoint[];
  readonly sampled: boolean;
}

const DAY_MS = 86_400_000;
const MAX_POINTS = 120;

function dayCount(range: ComparisonDateRange): number {
  return Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1;
}

function pointAmount(point: TimeSeriesPoint, metric: CumulativeComparisonMetric): number {
  if (metric === "expenses") return -point.expensesEurMinor || 0;
  if (metric === "income") return point.incomesEurMinor;
  return point.netEurMinor;
}

function buildCurve(
  filtered: FilteredAnalyticsDataset,
  range: ComparisonDateRange,
  metric: CumulativeComparisonMetric,
  milestones: readonly number[],
): readonly CumulativeComparisonPoint[] | null {
  const days = dayCount(range);
  if (!Number.isSafeInteger(days) || days < 1) return null;
  // The existing daily aggregator applies the same posting buckets, VOID rule,
  // date basis and safe-integer arithmetic as the comparison KPIs. No gap fill
  // is requested: a millennial range costs at most its recorded activity.
  const activity = aggregateTimeSeries(filtered, "day", { fillGaps: false });
  const curve: CumulativeComparisonPoint[] = [];
  let cumulative = 0;
  let activityIndex = 0;
  for (const day of milestones) {
    if (day > days) break;
    const offset = day - 1;
    const date = addIsoDays(range.from, offset);
    while (activityIndex < activity.length && activity[activityIndex]!.startDate <= date) {
      cumulative += pointAmount(activity[activityIndex]!, metric);
      if (!Number.isSafeInteger(cumulative)) return null;
      activityIndex += 1;
    }
    curve.push({ day, date, eurMinor: cumulative === 0 ? 0 : cumulative });
  }
  return curve;
}

export function buildCumulativeComparison(
  filtered: FilteredAnalyticsDataset,
  comparison: PeriodComparisonResult,
  metric: CumulativeComparisonMetric,
): CumulativeComparison | null {
  const selected = comparison.metrics.find((item) => item.key === metric);
  if (selected === undefined) return null;
  const currentDays = dayCount(comparison.currentRange);
  const referenceDays = dayCount(comparison.referenceRange);
  const longest = Math.max(currentDays, referenceDays);
  if (!Number.isSafeInteger(longest) || currentDays < 1 || referenceDays < 1) return null;
  // Shared day offsets keep the chart's ordered label union monotonic. Reserve
  // one slot for the shorter range's exact endpoint when long ranges sample.
  const count = longest <= MAX_POINTS ? longest : MAX_POINTS - 1;
  const milestones = Array.from({ length: count }, (_, index) =>
    count === 1 ? 1 : Math.round(index * (longest - 1) / (count - 1)) + 1,
  );
  milestones.push(Math.min(currentDays, referenceDays));
  milestones.sort((left, right) => left - right);
  const uniqueMilestones = milestones.filter((day, index) => index === 0 || day !== milestones[index - 1]);
  const referenceFiltered = applyFilters(filtered.source, {
    ...filtered.filters,
    periodMode: "custom",
    dateRange: comparison.referenceRange,
  });
  const current = buildCurve(filtered, comparison.currentRange, metric, uniqueMilestones);
  const reference = buildCurve(referenceFiltered, comparison.referenceRange, metric, uniqueMilestones);
  if (current === null || reference === null || current.length === 0 || reference.length === 0) return null;
  // Never expose a line whose endpoint disagrees with the established KPI.
  if (current.at(-1)!.eurMinor !== selected.currentEurMinor || reference.at(-1)!.eurMinor !== selected.referenceEurMinor) return null;
  return {
    current,
    reference,
    sampled: longest > MAX_POINTS,
  };
}
