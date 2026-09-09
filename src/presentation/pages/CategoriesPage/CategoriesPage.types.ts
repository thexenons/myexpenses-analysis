import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/index.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/index.ts";
import type { CategoryBreakdownNode } from "../../../domain/analytics/types.ts";

export type CategoryMetric = "netEurMinor" | "expensesEurMinor" | "incomesEurMinor" | "realCashFlowEurMinor" | "debtFlowEurMinor";
export type CategoryLevel = "roots" | "direct";

export interface CategoryChartOptions {
  readonly metric: CategoryMetric;
  readonly level: CategoryLevel;
  readonly seriesLimit: number;
}

export interface CategoriesPageViewProps {
  readonly activityEurMinor: number;
  readonly categoryBars: readonly ChartBarDatum[];
  readonly categoryCount: number;
  readonly categorySeries: readonly ChartSeries[];
  readonly categoryTree: readonly CategoryBreakdownNode[];
  readonly directPostingCount: number;
  readonly expenseEurMinor: number;
  readonly chartOptions?: CategoryChartOptions;
  readonly onChartOptionsChange?: (options: CategoryChartOptions) => void;
  readonly onViewCategory?: (id: string) => void;
  readonly onViewTransactions?: () => void;
  readonly onViewPeriod?: (label: string) => void;
  readonly onClearCategory: () => void;
  readonly onToggleCategory: (path: readonly string[]) => void;
  readonly selectedCategoryIds: ReadonlySet<string>;
  readonly selectionDetail: string;
  readonly showClearCategory: boolean;
}
