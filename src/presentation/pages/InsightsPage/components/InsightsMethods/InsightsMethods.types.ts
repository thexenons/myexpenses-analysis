import type { PaymentMethodInsights } from "../../../../../domain/analytics/backup-insights.ts";

export interface InsightsMethodsProps {
  readonly methods: PaymentMethodInsights;
  readonly onViewMethod?: (identityKey: string) => void;
  readonly searchPending?: boolean;
}
