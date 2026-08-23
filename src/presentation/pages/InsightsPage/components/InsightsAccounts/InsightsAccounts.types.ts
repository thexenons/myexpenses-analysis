import type { BackupInsights } from "../../../../../domain/analytics/backup-insights.ts";
import type { ChartBarDatum } from "../../../../components/organisms/HorizontalBarChart/HorizontalBarChart.types.ts";

export interface InsightsAccountsProps {
  readonly accountBars: readonly ChartBarDatum[];
  readonly insights: BackupInsights;
}
