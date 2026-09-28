import type { PayeeInsights } from "../../../../../domain/analytics/backup-insights.ts";

export interface InsightsPayeesProps {
  readonly onViewPayee?: (identityKey: string) => void;
  readonly payees: PayeeInsights;
  readonly searchPending?: boolean;
}
