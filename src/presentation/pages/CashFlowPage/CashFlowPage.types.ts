import type { DivergingBarDatum } from "../../components/organisms/DivergingBarChart/index.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/index.ts";
import type {
  CategoryBreakdownNode,
  FlowComposition,
  KpiSummary,
} from "../../../domain/analytics/types.ts";

export interface CashFlowPageViewProps {
  readonly composition: FlowComposition;
  readonly expenseCategories: readonly CategoryBreakdownNode[];
  readonly lineSeries: readonly ChartSeries[];
  readonly periodBars: readonly DivergingBarDatum[];
  readonly savingsEurMinor: number;
  readonly kpis: KpiSummary;
}
