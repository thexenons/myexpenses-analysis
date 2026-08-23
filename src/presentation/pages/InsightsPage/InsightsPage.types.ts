import type {
  BackupInsights,
} from "../../../domain/analytics/backup-insights.ts";
import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/HorizontalBarChart.types.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/LineChart.types.ts";

export interface InsightsPageViewProps {
  readonly accountBars: readonly ChartBarDatum[];
  readonly hourSeries: readonly ChartSeries[];
  readonly insights: BackupInsights;
  readonly lagBars: readonly ChartBarDatum[];
  readonly searchPending: boolean;
  readonly weekdayBars: readonly ChartBarDatum[];
}
