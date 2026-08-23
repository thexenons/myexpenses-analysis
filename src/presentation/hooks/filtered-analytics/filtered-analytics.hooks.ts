import { useDeferredValue, useMemo } from "react";

import { applyFilters } from "../../../domain/analytics/filters.ts";
import { useAppStore } from "../../providers/AppStoreProvider/index.ts";

export function useFilteredAnalytics() {
  const analytics = useAppStore((state) => state.analytics);
  const filters = useAppStore((state) => state.filters);
  const granularity = useAppStore((state) => state.granularity);
  const deferredSearch = useDeferredValue(filters.search);
  const deferredFilters = useMemo(
    () => ({
      accountIds: filters.accountIds,
      categoryPrefixes: filters.categoryPrefixes,
      dateRange: filters.dateRange,
      linked: filters.linked,
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
      filters.scope,
      filters.statuses,
      filters.tags,
    ],
  );
  const filtered = useMemo(
    () => (analytics === null ? null : applyFilters(analytics, deferredFilters)),
    [analytics, deferredFilters],
  );

  return {
    analytics,
    filtered,
    filters,
    granularity,
    searchPending: filters.search !== deferredSearch,
  };
}
