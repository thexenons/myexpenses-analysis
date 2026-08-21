import type { ChartSeries } from "../../components/organisms/AreaChart/index.ts";
import type {
  AccountBreakdownItem,
  CategoryBreakdownNode,
  KpiSummary,
  StatusCounts,
} from "../../../domain/analytics/types.ts";

export interface OverviewCategoryRank {
  readonly activityPercent: number;
  readonly category: CategoryBreakdownNode;
}

export interface OverviewAmountRow {
  readonly amountEurMinor: number;
  readonly label: string;
}

export interface OverviewPageViewProps {
  readonly accounts: readonly AccountBreakdownItem[];
  readonly chartSeries: readonly ChartSeries[];
  readonly debtAccountCount: number;
  readonly debtBalanceEurMinor: number;
  readonly expenseComposition: readonly OverviewAmountRow[];
  readonly kpis: KpiSummary;
  readonly searchPending: boolean;
  readonly status: StatusCounts;
  readonly topCategories: readonly OverviewCategoryRank[];
  readonly valuationBalanceEurMinor: number;
}
