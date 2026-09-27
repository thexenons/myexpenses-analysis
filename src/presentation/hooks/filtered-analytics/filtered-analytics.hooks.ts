import { useDeferredValue, useMemo } from "react";

import { resolveTimeGranularity } from "../../../domain/analytics/date-periods.ts";
import { datasetDateBounds } from "../../../domain/analytics/date-bounds.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
import { useAppStore } from "../../providers/AppStoreProvider/index.ts";

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
      originAccountIds: filters.originAccountIds,
      destinationAccountIds: filters.destinationAccountIds,
      dateBasis: filters.dateBasis,
      categoryMatch: filters.categoryMatch,
      categoryDepth: filters.categoryDepth,
      categoryPrefixes: filters.categoryPrefixes,
      dateRange: filters.dateRange,
      linked: filters.linked,
      periodMode: filters.periodMode,
      scope: filters.scope,
      search: deferredSearch,
      statuses: filters.statuses,
      tags: filters.tags,
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
      filters.originAccountIds,
      filters.destinationAccountIds,
      filters.dateBasis,
      filters.categoryMatch,
      filters.categoryDepth,
      filters.categoryPrefixes,
      filters.dateRange,
      filters.linked,
      filters.periodMode,
      filters.scope,
      filters.statuses,
      filters.tags,
      filters.payeeKeys,
      filters.paymentMethodKeys,
      filters.categoryTypes,
      filters.currencies,
      filters.minAmountEurMinor,
      filters.maxAmountEurMinor,
    ],
  );
  const filtered = useMemo(
    () => (analytics === null ? null : applyFilters(analytics, deferredFilters)),
    [analytics, deferredFilters],
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
    filters,
    granularity,
    granularitySetting,
    searchPending: filters.search !== deferredSearch || filters.commentSearch !== deferredCommentSearch || filters.referenceSearch !== deferredReferenceSearch,
  };
}
