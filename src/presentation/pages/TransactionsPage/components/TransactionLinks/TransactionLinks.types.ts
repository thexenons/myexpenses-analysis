import type { AnalyticsDataset, NormalizedPosting } from "../../../../../domain/analytics/types.ts";

export interface TransactionLinksProps {
  readonly dataset: AnalyticsDataset;
  readonly posting: NormalizedPosting;
}
