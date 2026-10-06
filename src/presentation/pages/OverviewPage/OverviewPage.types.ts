import type { ChartSeries } from "../../components/organisms/AreaChart/index.ts";
import type {
  AccountBreakdownItem,
  CategoryBreakdownNode,
  KpiSummary,
  StatusCounts,
} from "../../../domain/analytics/types.ts";

export interface OverviewCategoryRank {
  readonly category: CategoryBreakdownNode;
}

export interface OverviewAmountRow {
  readonly amountEurMinor: number;
  readonly label: string;
}

export type OverviewReviewId = "uncategorized" | "unreconciled";

export interface OverviewReviewSignal {
  readonly id: OverviewReviewId;
  readonly count: number;
}

export interface OverviewReview {
  readonly context: string;
  readonly hasData: boolean;
  readonly signals: readonly OverviewReviewSignal[];
}

export interface OverviewPageViewProps {
  readonly review?: OverviewReview;
  readonly onViewReview?: (id: OverviewReviewId) => void;
  readonly accounts: readonly AccountBreakdownItem[];
  readonly chartSeries: readonly ChartSeries[];
  readonly cumulativeChartSeries?: readonly ChartSeries[] | null;
  readonly debtAccountCount: number;
  readonly debtBalanceEurMinor: number;
  readonly expenseComposition: readonly OverviewAmountRow[];
  readonly kpis: KpiSummary;
  readonly searchPending: boolean;
  readonly status: StatusCounts;
  readonly topCategories: readonly OverviewCategoryRank[];
  readonly valuationBalanceEurMinor: number;
}
