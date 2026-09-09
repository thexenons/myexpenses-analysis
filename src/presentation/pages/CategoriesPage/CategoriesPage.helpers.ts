import {
  aggregateCategoryBreakdown,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import {
  applyFilters,
  categoryPathsEqual,
} from "../../../domain/analytics/filters.ts";
import type {
  AnalyticsDataset,
  CategoryBreakdownNode,
  FilteredAnalyticsDataset,
  NormalizedPosting,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type { CategoriesPageViewProps, CategoryChartOptions } from "./CategoriesPage.types.ts";

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
): CategoriesPageViewProps {
  const categories = aggregateCategoryBreakdown(filtered);
  const visibleCategories = aggregateCategoryBreakdown(
    applyFilters(analytics, {
      ...filtered.filters,
      categoryPrefixes: [],
    }),
  );
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
    !selectedFilteredCategories.some((parent) => parent.path.length < category.path.length &&
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

  return {
    activityEurMinor,
    categoryBars: barCategories.map((category) => ({
      id: category.id,
      label: category.path.join(" › "),
      value: euroFromMinor(category[chartOptions.level === "direct" ? "directSummary" : "summary"][chartOptions.metric]),
      color: categoryColor(category),
    })),
    categoryCount: flattenedCategories.length,
    categorySeries: comparisonCategories.map((category) => {
      // Partition the already filtered postings. Reapplying only this category
      // would broaden an exact-path or counterpart-category selection.
      const matchesCategory = (posting: NormalizedPosting) => chartOptions.level === "direct"
        ? categoryPathsEqual(posting.categoryPath, category.path)
        : category.path.every((segment, pathIndex) => posting.categoryPath[pathIndex] === segment);
      const scoped = {
        ...filtered,
        postings: filtered.postings.filter(matchesCategory),
        activePostings: filtered.activePostings.filter(matchesCategory),
      };
      return {
        id: category.id,
        label: category.path.join(" › "),
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
          ? categoryPrefixes[0]!.join(" › ")
          : `${categoryPrefixes.length} categorías seleccionadas`,
    showClearCategory: categoryPrefixes.length > 0,
  };
}
