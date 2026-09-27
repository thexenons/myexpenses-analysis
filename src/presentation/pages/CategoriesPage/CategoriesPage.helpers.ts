import {
  aggregateCategoryBreakdown,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import { aggregateCategoryPeriodAverages } from "../../../domain/analytics/category-period-average.ts";
import { isoDateInTimeZone } from "../../../domain/analytics/date-periods.ts";
import {
  applyFilters,
  categoryPathsEqual,
} from "../../../domain/analytics/filters.ts";
import type {
  AnalyticsDataset,
  CategoryBreakdownNode,
  FilteredAnalyticsDataset,
  FilterState,
  IsoDate,
  NormalizedPosting,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor, formatCategoryPath } from "../../utils/format.ts";
import type { CategoriesPageViewProps, CategoryChartOptions, CategoryLevel } from "./CategoriesPage.types.ts";

export const DEFAULT_CATEGORY_CHART_OPTIONS: CategoryChartOptions = {
  metric: "netEurMinor", level: "roots", seriesLimit: 4,
};

export const CATEGORY_METRIC_LABELS = {
  netEurMinor: "Importe neto",
  expensesEurMinor: "Gasto neto (con signo)",
  incomesEurMinor: "Ingresos netos",
  realCashFlowEurMinor: "Flujo de caja real",
  debtFlowEurMinor: "Movimiento en deudas",
} as const;

export function createCategoryDrilldownFilters(
  filters: FilterState,
  path: readonly string[],
  level: CategoryLevel,
): Pick<FilterState, "categoryPrefixes" | "categoryDepth" | "categoryMatch"> {
  const preserveExactSelection = level !== "direct" &&
    filters.categoryDepth === "exact" && filters.categoryPrefixes.length > 0;
  return {
    categoryPrefixes: preserveExactSelection
      ? filters.categoryPrefixes.filter((selected) => path.length === 0
        ? selected.length === 0
        : path.every((segment, index) => selected[index] === segment))
      : [path],
    categoryDepth: level === "direct" || preserveExactSelection ? "exact" : "subtree",
    categoryMatch: "posting",
  };
}

function categoryColor(category: CategoryBreakdownNode): string {
  return category.categoryType === "EXPENSE" ? "#a33f36"
    : category.categoryType === "INCOME" ? "#286a4c" : "#35698b";
}

function appendCategoryTree(
  nodes: readonly CategoryBreakdownNode[],
  result: CategoryBreakdownNode[],
): void {
  for (const node of nodes) {
    result.push(node);
    appendCategoryTree(node.children, result);
  }
}

function flattenCategories(
  nodes: readonly CategoryBreakdownNode[],
): readonly CategoryBreakdownNode[] {
  const result: CategoryBreakdownNode[] = [];
  appendCategoryTree(nodes, result);
  return result;
}

export function createCategoriesPageModel(
  analytics: AnalyticsDataset,
  filtered: FilteredAnalyticsDataset,
  categoryPrefixes: readonly (readonly string[])[],
  granularity: TimeGranularity,
  onClearCategory: () => void,
  onToggleCategory: (path: readonly string[]) => void,
  chartOptions: CategoryChartOptions = DEFAULT_CATEGORY_CHART_OPTIONS,
  onChartOptionsChange?: (options: CategoryChartOptions) => void,
  onViewCategory?: (id: string) => void,
  onViewTransactions?: () => void,
  onViewPeriod?: (label: string) => void,
  today: IsoDate = isoDateInTimeZone(new Date(), analytics.backup?.preferences.timeZone ?? "Europe/Madrid"),
): CategoriesPageViewProps {
  const categories = aggregateCategoryBreakdown(filtered);
  const visibleFiltered = applyFilters(analytics, {
    ...filtered.filters,
    categoryPrefixes: [],
  });
  const visibleCategories = aggregateCategoryBreakdown(visibleFiltered);
  const categoryAverages = aggregateCategoryPeriodAverages(visibleFiltered, granularity, today);
  const flattenedCategories = flattenCategories(visibleCategories);
  const selectedCategories = flattenedCategories.filter((category) =>
    categoryPrefixes.some((path) => categoryPathsEqual(category.path, path)),
  );
  const activityEurMinor = categories.reduce(
    (sum, item) => sum + item.summary.netEurMinor,
    0,
  );
  const expenseEurMinor = -categories.reduce((sum, item) => sum + item.summary.expensesEurMinor, 0) || 0;
  // Every chart compares a partition: inclusive roots or disjoint exact paths.
  // Showing an inclusive parent beside its descendants would count money twice.
  const selectedFilteredCategories = filtered.filters.categoryMatch === "either"
    ? []
    : flattenCategories(categories).filter((category) => categoryPrefixes.some((path) => categoryPathsEqual(category.path, path)));
  const nonOverlappingSelection = selectedFilteredCategories.filter((category) =>
    !selectedFilteredCategories.some((parent) => parent.path.length > 0 && parent.path.length < category.path.length &&
      parent.path.every((segment, index) => category.path[index] === segment)),
  );
  const barCategories = (chartOptions.level === "direct"
    ? flattenCategories(categories).filter((category) => category.directSummary.postingCount > 0)
    : nonOverlappingSelection.length > 0 ? nonOverlappingSelection : categories)
    .toSorted((left, right) => {
      const summaryKey = chartOptions.level === "direct" ? "directSummary" : "summary";
      return Math.abs(right[summaryKey][chartOptions.metric]) - Math.abs(left[summaryKey][chartOptions.metric]) || left.id.localeCompare(right.id);
    });
  const comparisonCategories = categoryPrefixes.length > 0 || chartOptions.seriesLimit === 0
    ? barCategories
    : barCategories.slice(0, chartOptions.seriesLimit);
  const flowTimeline = aggregateTimeSeries(filtered, granularity);
  const flowDateRange = {
    from: filtered.filters.dateRange.from ?? flowTimeline[0]?.startDate ?? null,
    to: filtered.filters.dateRange.to ?? flowTimeline.at(-1)?.endDate ?? null,
  };

  return {
    activityEurMinor,
    categoryBars: barCategories.map((category) => ({
      id: category.id,
      label: formatCategoryPath(category.path),
      value: euroFromMinor(category[chartOptions.level === "direct" ? "directSummary" : "summary"][chartOptions.metric]),
      color: categoryColor(category),
    })),
    categoryCount: flattenedCategories.length,
    categoryAverageEurMinorById: categoryAverages.averageEurMinorByCategoryId,
    completedPeriodCount: categoryAverages.completedPeriodCount,
    averageUnit: granularity,
    categorySeries: comparisonCategories.map((category) => {
      // Partition the already filtered postings. Reapplying only this category
      // would broaden an exact-path or counterpart-category selection.
      const matchesCategory = (posting: NormalizedPosting) => chartOptions.level === "direct" || category.path.length === 0
        ? categoryPathsEqual(posting.categoryPath, category.path)
        : category.path.every((segment, pathIndex) => posting.categoryPath[pathIndex] === segment);
      const scoped = {
        ...filtered,
        filters: { ...filtered.filters, dateRange: flowDateRange },
        postings: filtered.postings.filter(matchesCategory),
        activePostings: filtered.activePostings.filter(matchesCategory),
      };
      return {
        id: category.id,
        label: formatCategoryPath(category.path),
        color: categoryColor(category),
        data: aggregateTimeSeries(scoped, granularity).map((point) => ({
          label: point.key,
          value: euroFromMinor(point[chartOptions.metric]),
        })),
      };
    }),
    categoryTree: visibleCategories,
    directPostingCount: flattenCategories(categories).reduce(
      (sum, category) => sum + category.directSummary.postingCount,
      0,
    ),
    expenseEurMinor,
    chartOptions,
    onChartOptionsChange,
    onViewCategory: filtered.filters.categoryMatch === "either" && categoryPrefixes.length > 0 ? undefined : onViewCategory,
    onViewTransactions,
    onViewPeriod,
    onClearCategory,
    onToggleCategory,
    selectedCategoryIds: new Set(selectedCategories.map((category) => category.id)),
    selectionDetail:
      categoryPrefixes.length === 0
        ? "Árbol completo"
        : categoryPrefixes.length === 1
          ? formatCategoryPath(categoryPrefixes[0]!)
          : `${categoryPrefixes.length} categorías seleccionadas`,
    showClearCategory: categoryPrefixes.length > 0,
  };
}
