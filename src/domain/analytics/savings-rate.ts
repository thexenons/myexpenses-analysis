import { aggregateTimeSeries } from "./aggregations.ts";
import { datasetDateBounds } from "./date-bounds.ts";
import type { FilteredAnalyticsDataset, IsoDate } from "./types.ts";

export interface MonthlySavingsRatePoint {
  readonly key: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
  readonly incomeEurMinor: number;
  readonly expensesEurMinor: number;
  readonly resultEurMinor: number;
  /** Signed percentage; null when net income is zero or negative. */
  readonly ratePercent: number | null;
}

export type MonthlySavingsRateResult =
  | { readonly status: "available"; readonly months: readonly MonthlySavingsRatePoint[] }
  | { readonly status: "unavailable"; readonly reason: "subset" | "noCompleteMonths" };

function hasSubset(filtered: FilteredAnalyticsDataset): boolean {
  const filters = filtered.filters;
  return filters.scope !== "all" || filters.accountIds.length > 0 ||
    (filters.originAccountIds?.length ?? 0) > 0 || (filters.destinationAccountIds?.length ?? 0) > 0 ||
    filters.categoryPrefixes.length > 0 || filters.statuses.length > 0 || filters.tags.length > 0 ||
    filters.search !== "" || filters.linked !== "all" ||
    (filters.payeeKeys?.length ?? 0) > 0 || (filters.paymentMethodKeys?.length ?? 0) > 0 ||
    (filters.categoryTypes?.length ?? 0) > 0 || (filters.currencies?.length ?? 0) > 0 ||
    filters.minAmountEurMinor != null || filters.maxAmountEurMinor != null ||
    (filters.commentSearch ?? "") !== "" || (filters.referenceSearch ?? "") !== "";
}

/** Accounting result over selected Yo accounts, never available cash or net worth. */
export function analyzeMonthlySavingsRate(
  filtered: FilteredAnalyticsDataset,
  today: IsoDate,
): MonthlySavingsRateResult {
  if (hasSubset(filtered)) return { status: "unavailable", reason: "subset" };
  const observed = datasetDateBounds(filtered.source, filtered.filters.dateBasis);
  const from = filtered.filters.dateRange.from !== null && observed.minDate !== null && filtered.filters.dateRange.from > observed.minDate
    ? filtered.filters.dateRange.from : observed.minDate;
  const to = filtered.filters.dateRange.to !== null && observed.maxDate !== null && filtered.filters.dateRange.to < observed.maxDate
    ? filtered.filters.dateRange.to : observed.maxDate;
  if (from === null || to === null || from > to) return { status: "unavailable", reason: "noCompleteMonths" };

  const monthly = aggregateTimeSeries({
    ...filtered,
    filters: { ...filtered.filters, dateRange: { from, to } },
  }, "month", { monthStart: 1 });
  const months = monthly.flatMap((point): MonthlySavingsRatePoint[] => {
    if (point.startDate < from || point.endDate > to || point.endDate >= today) return [];
    const resultEurMinor = point.incomesEurMinor + point.expensesEurMinor;
    if (!Number.isSafeInteger(resultEurMinor)) throw new Error("Monthly accounting result exceeds the safe integer range");
    const ratePercent = point.incomesEurMinor > 0 ? resultEurMinor / point.incomesEurMinor * 100 : null;
    return [{
      key: point.key,
      startDate: point.startDate,
      endDate: point.endDate,
      incomeEurMinor: point.incomesEurMinor,
      expensesEurMinor: point.expensesEurMinor,
      resultEurMinor,
      ratePercent: ratePercent !== null && Number.isFinite(ratePercent) ? ratePercent : null,
    }];
  });
  return months.length > 0 ? { status: "available", months } : { status: "unavailable", reason: "noCompleteMonths" };
}
