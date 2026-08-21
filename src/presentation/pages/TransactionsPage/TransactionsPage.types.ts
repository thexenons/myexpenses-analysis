import type { NormalizedPosting } from "../../../domain/analytics/types.ts";

export type TransactionSortKey = "amount" | "date";

export interface TransactionsPageViewProps {
  readonly descending: boolean;
  readonly onDownload: () => void;
  readonly onPageChange: (page: number) => void;
  readonly onSort: (key: TransactionSortKey) => void;
  readonly page: number;
  readonly pageCount: number;
  readonly postings: readonly NormalizedPosting[];
  readonly resultCount: number;
  readonly searchPending: boolean;
  readonly sortKey: TransactionSortKey;
}
