import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { toggleCategoryPath } from "../../../../domain/analytics/filters.ts";
import { aggregateTimeSeries } from "../../../../domain/analytics/aggregations.ts";
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createCategoriesPageModel, DEFAULT_CATEGORY_CHART_OPTIONS } from "../CategoriesPage.helpers.ts";
import type { CategoriesPageViewProps } from "../CategoriesPage.types.ts";

export function useCategoriesPage(): CategoriesPageViewProps | null {
  const { analytics, filtered, filters, granularity } = useFilteredAnalytics();
  const navigate = useNavigate();
  const [chartOptions, onChartOptionsChange] = useState(DEFAULT_CATEGORY_CHART_OPTIONS);
  const setCategoryPrefixes = useAppStore(
    (state) => state.actions.setCategoryPrefixes,
  );
  const patchFilters = useAppStore((state) => state.actions.patchFilters);
  const onClearCategory = useCallback(
    () => setCategoryPrefixes([]),
    [setCategoryPrefixes],
  );
  const onToggleCategory = useCallback(
    (path: readonly string[]) =>
      setCategoryPrefixes(toggleCategoryPath(filters.categoryPrefixes, path)),
    [filters.categoryPrefixes, setCategoryPrefixes],
  );
  const onViewTransactions = useCallback(() => {
    void navigate({ to: "/transacciones", search: { page: 1, sort: "date", direction: "desc" } });
  }, [navigate]);
  const onViewCategory = useCallback((id: string) => {
    patchFilters({
      categoryPrefixes: [JSON.parse(id) as string[]],
      categoryDepth: chartOptions.level === "direct" ? "exact" : filters.categoryDepth ?? "subtree",
      categoryMatch: "posting",
    });
    onViewTransactions();
  }, [chartOptions.level, filters.categoryDepth, onViewTransactions, patchFilters]);
  const onViewPeriod = useCallback((label: string) => {
    if (filtered === null) return;
    const period = aggregateTimeSeries(filtered, granularity).find((point) => point.key === label);
    if (period === undefined) return;
    const range = filtered.filters.dateRange;
    patchFilters({
      periodMode: "custom",
      dateRange: {
        from: range.from !== null && range.from > period.startDate ? range.from : period.startDate,
        to: range.to !== null && range.to < period.endDate ? range.to : period.endDate,
      },
    });
    onViewTransactions();
  }, [filtered, granularity, onViewTransactions, patchFilters]);

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
            chartOptions,
            onChartOptionsChange,
            onViewCategory,
            onViewTransactions,
            onViewPeriod,
          ),
    [
      analytics,
      filtered,
      filters.categoryPrefixes,
      granularity,
      onClearCategory,
      onToggleCategory,
      chartOptions,
      onViewCategory,
      onViewTransactions,
      onViewPeriod,
    ],
  );
}
