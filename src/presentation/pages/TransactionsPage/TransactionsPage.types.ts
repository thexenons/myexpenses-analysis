import type { AnalyticsDataset, KpiSummary, NormalizedPosting } from "../../../domain/analytics/types.ts";

export type TransactionSortKey = "amount" | "date";

export interface TransactionsPageViewProps {
  readonly dataset?: AnalyticsDataset;
  readonly dateBasis?: "operation" | "value";
  readonly descending: boolean;
  readonly onDownload: () => void;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (size: number) => void;
  readonly onSort: (key: TransactionSortKey) => void;
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize?: number;
  readonly postings: readonly NormalizedPosting[];
  readonly resultCount: number;
  readonly searchPending: boolean;
  readonly sortKey: TransactionSortKey;
  readonly summary?: KpiSummary;
}
