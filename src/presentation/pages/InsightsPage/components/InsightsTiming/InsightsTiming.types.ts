import type { TimingInsights } from "../../../../../domain/analytics/backup-insights.ts";
import type { ChartBarDatum } from "../../../../components/organisms/HorizontalBarChart/HorizontalBarChart.types.ts";
import type { ChartSeries } from "../../../../components/organisms/LineChart/LineChart.types.ts";

export interface InsightsTimingProps {
  readonly hourSeries: readonly ChartSeries[];
  readonly timing: TimingInsights;
  readonly weekdayBars: readonly ChartBarDatum[];
}
