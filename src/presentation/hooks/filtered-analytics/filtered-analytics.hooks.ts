import { useDeferredValue, useMemo } from "react";

import { resolveTimeGranularity } from "../../../domain/analytics/date-periods.ts";
import { datasetDateBounds } from "../../../domain/analytics/date-bounds.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
import type { AnalyticsDataset, FilterState, FilteredAnalyticsDataset } from "../../../domain/analytics/types.ts";
import { useAppStore } from "../../providers/AppStoreProvider/index.ts";

const PRESENTATION_STATUSES: [] = [];
const MAX_SHARED_DERIVATIONS = 2;
const sharedDerivations = new WeakMap<AnalyticsDataset, Array<{
  filters: FilterState;
  result: FilteredAnalyticsDataset;
}>>();

function filtersMatch(left: FilterState, right: FilterState): boolean {
  return Object.keys(left).every(
    (key) => left[key as keyof FilterState] === right[key as keyof FilterState],
  );
}

function deriveFilteredAnalytics(dataset: AnalyticsDataset, filters: FilterState): FilteredAnalyticsDataset {
  const entries = sharedDerivations.get(dataset) ?? [];
  const cached = entries.find((entry) => filtersMatch(entry.filters, filters));
  if (cached) return cached.result;

  const result = applyFilters(dataset, filters);
  const projected = { ...result, postings: result.activePostings };
  entries.unshift({ filters, result: projected });
  entries.length = Math.min(entries.length, MAX_SHARED_DERIVATIONS);
  sharedDerivations.set(dataset, entries);
  return projected;
}

export function useFilteredAnalytics() {
  const analytics = useAppStore((state) => state.analytics);
  const filters = useAppStore((state) => state.filters);
  const granularitySetting = useAppStore((state) => state.granularity);
  const deferredSearch = useDeferredValue(filters.search);
  const deferredCommentSearch = useDeferredValue(filters.commentSearch);
  const deferredReferenceSearch = useDeferredValue(filters.referenceSearch);
  const deferredFilters = useMemo(
    () => ({
      accountIds: filters.accountIds,
      accountMode: filters.accountMode,
      originAccountIds: filters.originAccountIds,
      destinationAccountIds: filters.destinationAccountIds,
      dateBasis: filters.dateBasis,
      categoryMatch: filters.categoryMatch,
      categoryDepth: filters.categoryDepth,
      categoryMode: filters.categoryMode,
      categoryPrefixes: filters.categoryPrefixes,
      dateRange: filters.dateRange,
      linked: filters.linked,
      periodMode: filters.periodMode,
      scope: filters.scope,
      search: deferredSearch,
      statuses: PRESENTATION_STATUSES,
      tags: filters.tags,
      tagMode: filters.tagMode,
      payeeKeys: filters.payeeKeys,
      paymentMethodKeys: filters.paymentMethodKeys,
      categoryTypes: filters.categoryTypes,
      currencies: filters.currencies,
      minAmountEurMinor: filters.minAmountEurMinor,
      maxAmountEurMinor: filters.maxAmountEurMinor,
      commentSearch: deferredCommentSearch,
      referenceSearch: deferredReferenceSearch,
    }),
    [
      deferredSearch,
      deferredCommentSearch,
      deferredReferenceSearch,
      filters.accountIds,
      filters.accountMode,
      filters.originAccountIds,
      filters.destinationAccountIds,
      filters.dateBasis,
      filters.categoryMatch,
      filters.categoryDepth,
      filters.categoryMode,
      filters.categoryPrefixes,
      filters.dateRange,
      filters.linked,
      filters.periodMode,
      filters.scope,
      filters.tags,
      filters.tagMode,
      filters.payeeKeys,
      filters.paymentMethodKeys,
      filters.categoryTypes,
      filters.currencies,
      filters.minAmountEurMinor,
      filters.maxAmountEurMinor,
    ],
  );
  const filtered = useMemo(
    () => analytics === null ? null : deriveFilteredAnalytics(analytics, deferredFilters),
    [analytics, deferredFilters],
  );
  const effectiveFilters = useMemo(
    () => filters.statuses.length === 0 ? filters : { ...filters, statuses: PRESENTATION_STATUSES },
    [filters],
  );
  const bounds = analytics === null ? null : datasetDateBounds(analytics, filters.dateBasis);
  const granularity = resolveTimeGranularity(
    granularitySetting,
    filters.periodMode,
    filters.dateRange,
    bounds?.minDate ?? null,
    bounds?.maxDate ?? null,
  );

  return {
    analytics,
    filtered,
    filters: effectiveFilters,
    granularity,
    granularitySetting,
    searchPending: filters.search !== deferredSearch || filters.commentSearch !== deferredCommentSearch || filters.referenceSearch !== deferredReferenceSearch,
  };
}
