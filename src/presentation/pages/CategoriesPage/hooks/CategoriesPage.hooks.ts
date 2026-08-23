import { useCallback, useMemo } from "react";

import { toggleCategoryPath } from "../../../../domain/analytics/filters.ts";
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createCategoriesPageModel } from "../CategoriesPage.helpers.ts";
import type { CategoriesPageViewProps } from "../CategoriesPage.types.ts";

export function useCategoriesPage(): CategoriesPageViewProps | null {
  const { analytics, filtered, filters, granularity } = useFilteredAnalytics();
  const setCategoryPrefixes = useAppStore(
    (state) => state.actions.setCategoryPrefixes,
  );
  const onClearCategory = useCallback(
    () => setCategoryPrefixes([]),
    [setCategoryPrefixes],
  );
  const onToggleCategory = useCallback(
    (path: readonly string[]) =>
      setCategoryPrefixes(toggleCategoryPath(filters.categoryPrefixes, path)),
    [filters.categoryPrefixes, setCategoryPrefixes],
  );

  return useMemo(
    () =>
      analytics === null || filtered === null
        ? null
        : createCategoriesPageModel(
            analytics,
            filtered,
            filters.categoryPrefixes,
            granularity,
            onClearCategory,
            onToggleCategory,
          ),
    [
      analytics,
      filtered,
      filters.categoryPrefixes,
      granularity,
      onClearCategory,
      onToggleCategory,
    ],
  );
}
