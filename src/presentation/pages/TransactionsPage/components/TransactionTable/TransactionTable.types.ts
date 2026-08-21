import type { NormalizedPosting } from "../../../../../domain/analytics/types.ts";
import type { TransactionSortKey } from "../../TransactionsPage.types.ts";

export interface TransactionTableProps {
  readonly descending: boolean;
  readonly onSort: (key: TransactionSortKey) => void;
  readonly postings: readonly NormalizedPosting[];
  readonly sortKey: TransactionSortKey;
}
