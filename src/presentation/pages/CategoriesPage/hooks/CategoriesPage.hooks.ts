import { useCallback, useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createCategoriesPageModel } from "../CategoriesPage.helpers.ts";
import type { CategoriesPageViewProps } from "../CategoriesPage.types.ts";

export function useCategoriesPage(): CategoriesPageViewProps | null {
  const { analytics, filtered, filters, granularity } = useFilteredAnalytics();
  const setCategoryPrefix = useAppStore(
    (state) => state.actions.setCategoryPrefix,
  );
  const onClearCategory = useCallback(
    () => setCategoryPrefix([]),
    [setCategoryPrefix],
  );
  const onSelectCategory = useCallback(
    (path: readonly string[]) => setCategoryPrefix(path),
    [setCategoryPrefix],
  );

  return useMemo(
    () =>
      analytics === null || filtered === null
        ? null
        : createCategoriesPageModel(
            analytics,
            filtered,
            filters.categoryPrefix,
            granularity,
            onClearCategory,
            onSelectCategory,
          ),
    [
      analytics,
      filtered,
      filters.categoryPrefix,
      granularity,
      onClearCategory,
      onSelectCategory,
    ],
  );
}
