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
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type { CategoriesPageViewProps } from "./CategoriesPage.types.ts";

const CATEGORY_SERIES_COLORS = [
  "#a33f36",
  "#286a4c",
  "#35698b",
  "#bd7d2f",
] as const;

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
  const expenseEurMinor = Math.abs(
    categories.reduce((sum, item) => sum + item.summary.expensesEurMinor, 0),
  );
  const comparisonCategories =
    selectedCategories.length === 0
      ? visibleCategories.slice(0, 4)
      : selectedCategories.slice(0, 4);
  const barCategories =
    selectedCategories.length === 0
      ? flattenedCategories.slice(0, 12)
      : selectedCategories.length === 1 && selectedCategories[0]!.children.length > 0
        ? selectedCategories[0]!.children.slice(0, 12)
        : selectedCategories.slice(0, 12);

  return {
    activityEurMinor,
    categoryBars: barCategories.map((category) => ({
      id: category.id,
      label: category.path.join(" › "),
      value: euroFromMinor(Math.abs(category.summary.netEurMinor)),
      color:
        category.categoryType === "EXPENSE"
          ? "#a33f36"
          : category.categoryType === "INCOME"
            ? "#286a4c"
            : "#35698b",
    })),
    categoryCount: flattenedCategories.length,
    categorySeries: comparisonCategories.map((category, index) => {
      const scoped = applyFilters(analytics, {
        ...filtered.filters,
        categoryPrefixes: [category.path],
      });
      return {
        id: category.id,
        label: category.name,
        color: CATEGORY_SERIES_COLORS[index] ?? "#35698b",
        data: aggregateTimeSeries(scoped, granularity).map((point) => ({
          label: point.key,
          value: euroFromMinor(point.netEurMinor),
        })),
      };
    }),
    categoryTree: visibleCategories,
    directPostingCount: flattenCategories(categories).reduce(
      (sum, category) => sum + category.directSummary.postingCount,
      0,
    ),
    expenseEurMinor,
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
