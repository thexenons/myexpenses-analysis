import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/index.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/index.ts";
import type { CategoryBreakdownNode } from "../../../domain/analytics/types.ts";

export interface CategoriesPageViewProps {
  readonly activityEurMinor: number;
  readonly categoryBars: readonly ChartBarDatum[];
  readonly categorySeries: readonly ChartSeries[];
  readonly directPostingCount: number;
  readonly expenseEurMinor: number;
  readonly flattenedCategories: readonly CategoryBreakdownNode[];
  readonly onClearCategory: () => void;
  readonly onSelectCategory: (path: readonly string[]) => void;
  readonly selectedCategory: CategoryBreakdownNode | null;
  readonly showClearCategory: boolean;
}
