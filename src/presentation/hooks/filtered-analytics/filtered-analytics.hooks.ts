import { useDeferredValue, useMemo } from "react";

import { resolveTimeGranularity } from "../../../domain/analytics/date-periods.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
import { useAppStore } from "../../providers/AppStoreProvider/index.ts";

export function useFilteredAnalytics() {
  const analytics = useAppStore((state) => state.analytics);
  const filters = useAppStore((state) => state.filters);
  const granularitySetting = useAppStore((state) => state.granularity);
  const deferredSearch = useDeferredValue(filters.search);
  const deferredFilters = useMemo(
    () => ({
      accountIds: filters.accountIds,
      categoryPrefixes: filters.categoryPrefixes,
      dateRange: filters.dateRange,
      linked: filters.linked,
      periodMode: filters.periodMode,
      scope: filters.scope,
      search: deferredSearch,
      statuses: filters.statuses,
      tags: filters.tags,
    }),
    [
      deferredSearch,
      filters.accountIds,
      filters.categoryPrefixes,
      filters.dateRange,
      filters.linked,
      filters.periodMode,
      filters.scope,
      filters.statuses,
      filters.tags,
    ],
  );
  const filtered = useMemo(
    () => (analytics === null ? null : applyFilters(analytics, deferredFilters)),
    [analytics, deferredFilters],
  );
  const granularity = resolveTimeGranularity(
    granularitySetting,
    filters.periodMode,
    filters.dateRange,
    analytics?.minDate ?? null,
    analytics?.maxDate ?? null,
  );

  return {
    analytics,
    filtered,
    filters,
    granularity,
    granularitySetting,
    searchPending: filters.search !== deferredSearch,
  };
}
