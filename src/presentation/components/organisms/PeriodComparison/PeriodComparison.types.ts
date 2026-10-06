import type { FilteredAnalyticsDataset, FilterState } from "../../../../domain/analytics/types.ts";

export interface PeriodComparisonProps {
  readonly filtered: FilteredAnalyticsDataset;
  readonly searchPending?: boolean;
  readonly onViewCategory?: (filters: FilterState) => void;
}
