import type { TransactionSortKey } from "../pages/TransactionsPage/TransactionsPage.types.ts";

export type TransactionSortDirection = "asc" | "desc";

export interface TransactionsSearch {
  readonly direction: TransactionSortDirection;
  readonly page: number;
  readonly sort: TransactionSortKey;
}

function positivePage(value: unknown): number {
  const page =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function validateTransactionsSearch(
  search: Record<string, unknown>,
): TransactionsSearch {
  return {
    direction: search.direction === "asc" ? "asc" : "desc",
    page: positivePage(search.page),
    sort: search.sort === "amount" ? "amount" : "date",
  };
}
