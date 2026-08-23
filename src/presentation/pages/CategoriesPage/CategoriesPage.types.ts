import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/index.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/index.ts";
import type { CategoryBreakdownNode } from "../../../domain/analytics/types.ts";

export interface CategoriesPageViewProps {
  readonly activityEurMinor: number;
  readonly categoryBars: readonly ChartBarDatum[];
  readonly categoryCount: number;
  readonly categorySeries: readonly ChartSeries[];
  readonly categoryTree: readonly CategoryBreakdownNode[];
  readonly directPostingCount: number;
  readonly expenseEurMinor: number;
  readonly onClearCategory: () => void;
  readonly onToggleCategory: (path: readonly string[]) => void;
  readonly selectedCategoryIds: ReadonlySet<string>;
  readonly selectionDetail: string;
  readonly showClearCategory: boolean;
}
