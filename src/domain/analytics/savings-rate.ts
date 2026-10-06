import { aggregateTimeSeries } from "./aggregations.ts";
import { datasetDateBounds } from "./date-bounds.ts";
import { resolvePostingAccounts } from "./transfer-relations.ts";
import type { AnalyticsScope, FilteredAnalyticsDataset, IsoDate, NormalizedPosting } from "./types.ts";

export interface MonthlySavingsRatePoint {
  readonly key: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
  readonly incomeEurMinor: number;
  readonly expensesEurMinor: number;
  readonly resultEurMinor: number;
  /** Positive operational entries excluding verified internal transfers; Real only. */
  readonly cashEntriesEurMinor?: number;
  /** Signed percentage; null when the mode's denominator is zero or negative. */
  readonly ratePercent: number | null;
}

export type MonthlySavingsRateResult =
  | { readonly status: "available"; readonly mode: AnalyticsScope; readonly months: readonly MonthlySavingsRatePoint[] }
  | { readonly status: "unavailable"; readonly reason: "subset" | "noCompleteMonths" };

function hasSubset(filtered: FilteredAnalyticsDataset): boolean {
  const filters = filtered.filters;
  return filters.accountIds.length > 0 ||
    (filters.originAccountIds?.length ?? 0) > 0 || (filters.destinationAccountIds?.length ?? 0) > 0 ||
    filters.categoryPrefixes.length > 0 || filters.tags.length > 0 ||
    filters.search !== "" || filters.linked !== "all" ||
    (filters.payeeKeys?.length ?? 0) > 0 || (filters.paymentMethodKeys?.length ?? 0) > 0 ||
    (filters.categoryTypes?.length ?? 0) > 0 || (filters.currencies?.length ?? 0) > 0 ||
    filters.minAmountEurMinor != null || filters.maxAmountEurMinor != null ||
    (filters.commentSearch ?? "") !== "" || (filters.referenceSearch ?? "") !== "";
}

function isInternalOperationalEntry(posting: NormalizedPosting, filtered: FilteredAnalyticsDataset): boolean {
  const { peer, originAccount, destinationAccount } = resolvePostingAccounts(posting, filtered.source);
  return peer !== undefined && !peer.isVoid &&
    originAccount?.type === "DEFAULT" && destinationAccount?.type === "DEFAULT" &&
    originAccount.includedInAll !== false && destinationAccount.includedInAll !== false;
}

/** Calendar-month trends preserve each perspective's existing accounting meaning. */
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
  const entriesByMonth = filtered.filters.scope === "realCashFlow"
    ? new Map(aggregateTimeSeries({
      ...filtered,
      activePostings: filtered.activePostings.filter((posting) =>
        posting.amountNativeMinor > 0 && !isInternalOperationalEntry(posting, filtered)),
      filters: { ...filtered.filters, dateRange: { from, to } },
    }, "month", { monthStart: 1 }).map((point) => [point.key, point.realCashFlowEurMinor]))
    : undefined;
  const months = monthly.flatMap((point): MonthlySavingsRatePoint[] => {
    if (point.startDate < from || point.endDate > to || point.endDate >= today) return [];
    const mode = filtered.filters.scope;
    const resultEurMinor = mode === "all" ? point.incomesEurMinor + point.expensesEurMinor
      : mode === "realCashFlow" ? point.realCashFlowEurMinor : point.debtFlowEurMinor;
    if (!Number.isSafeInteger(resultEurMinor)) throw new Error("Monthly result exceeds the safe integer range");
    const base = mode === "realCashFlow" ? entriesByMonth?.get(point.key) ?? 0 : point.incomesEurMinor;
    const ratePercent = mode !== "debtsOnly" && base > 0 ? resultEurMinor / base * 100 : null;
    return [{
      key: point.key,
      startDate: point.startDate,
      endDate: point.endDate,
      incomeEurMinor: point.incomesEurMinor,
      expensesEurMinor: point.expensesEurMinor,
      resultEurMinor,
      ...(mode === "realCashFlow" ? { cashEntriesEurMinor: base } : {}),
      ratePercent: ratePercent !== null && Number.isFinite(ratePercent) ? ratePercent : null,
    }];
  });
  return months.length > 0 ? { status: "available", mode: filtered.filters.scope, months }
    : { status: "unavailable", reason: "noCompleteMonths" };
}
