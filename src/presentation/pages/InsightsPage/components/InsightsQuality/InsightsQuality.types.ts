import type {
  PaymentMethodInsights,
  ValueDateInsights,
} from "../../../../../domain/analytics/backup-insights.ts";
import type { ChartBarDatum } from "../../../../components/organisms/HorizontalBarChart/HorizontalBarChart.types.ts";

export interface InsightsQualityProps {
  readonly lagBars: readonly ChartBarDatum[];
  readonly paymentMethods: PaymentMethodInsights;
  readonly onViewMethod?: (identityKey: string) => void;
  readonly searchPending?: boolean;
  readonly valueDates: ValueDateInsights;
}
