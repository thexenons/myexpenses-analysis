import {
  aggregateCategoryBreakdown,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
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

export function flattenCategories(
  nodes: readonly CategoryBreakdownNode[],
): readonly CategoryBreakdownNode[] {
  const result: CategoryBreakdownNode[] = [];
  appendCategoryTree(nodes, result);
  return result;
}

function pathsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

export function createCategoriesPageModel(
  analytics: AnalyticsDataset,
  filtered: FilteredAnalyticsDataset,
  categoryPrefix: readonly string[],
  granularity: TimeGranularity,
  onClearCategory: () => void,
  onSelectCategory: (path: readonly string[]) => void,
): CategoriesPageViewProps {
  const categories = aggregateCategoryBreakdown(filtered);
  const flattenedCategories = flattenCategories(categories);
  const selectedCategory =
    categoryPrefix.length === 0
      ? null
      : (flattenedCategories.find((category) =>
          pathsEqual(category.path, categoryPrefix),
        ) ?? null);
  const activityEurMinor =
    selectedCategory?.summary.netEurMinor ??
    categories.reduce((sum, item) => sum + item.summary.netEurMinor, 0);
  const expenseEurMinor = Math.abs(
    selectedCategory?.summary.expensesEurMinor ??
      categories.reduce(
        (sum, item) => sum + item.summary.expensesEurMinor,
        0,
      ),
  );
  const comparisonCategories =
    selectedCategory === null ? categories.slice(0, 4) : [selectedCategory];
  const barCategories =
    selectedCategory === null
      ? flattenedCategories.slice(0, 12)
      : selectedCategory.children.length > 0
        ? selectedCategory.children.slice(0, 12)
        : [selectedCategory];

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
    categorySeries: comparisonCategories.map((category, index) => {
      const scoped = applyFilters(analytics, {
        ...filtered.filters,
        categoryPrefix: category.path,
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
    directPostingCount:
      selectedCategory?.directSummary.postingCount ??
      categories.reduce(
        (sum, category) => sum + category.directSummary.postingCount,
        0,
      ),
    expenseEurMinor,
    flattenedCategories,
    onClearCategory,
    onSelectCategory,
    selectedCategory,
    showClearCategory: categoryPrefix.length > 0,
  };
}
