import type { NormalizedPosting } from "../../../../../domain/analytics/types.ts";
import type { DataTableColumn } from "../../../../components/organisms/DataTable/index.ts";
import { formatDate } from "../../../../utils/format.ts";
import type { TransactionSortKey } from "../../TransactionsPage.types.ts";
import { TransactionAccount } from "../TransactionAccount/index.ts";
import { TransactionAmount } from "../TransactionAmount/index.ts";
import { TransactionConcept } from "../TransactionConcept/index.ts";
import { TransactionStatus } from "../TransactionStatus/index.ts";

export function createTransactionTableColumns(
  descending: boolean,
  sortKey: TransactionSortKey,
  onSort: (key: TransactionSortKey) => void,
): readonly DataTableColumn<NormalizedPosting>[] {
  return [
    {
      key: "date",
      header: "Fecha",
      cell: (posting) => formatDate(posting.date),
      onSort: () => onSort("date"),
      sortDirection:
        sortKey === "date" ? (descending ? "descending" : "ascending") : "none",
    },
    {
      key: "concept",
      header: "Concepto",
      cell: (posting) => <TransactionConcept posting={posting} />,
    },
    {
      key: "category",
      header: "Categoría",
      cell: (posting) => posting.categoryPath.join(" › "),
    },
    {
      key: "account",
      header: "Cuenta",
      cell: (posting) => <TransactionAccount posting={posting} />,
    },
    {
      key: "status",
      header: "Estado",
      cell: (posting) => <TransactionStatus posting={posting} />,
      align: "center",
    },
    {
      key: "amount",
      header: "Importe",
      cell: (posting) => <TransactionAmount posting={posting} />,
      align: "end",
      onSort: () => onSort("amount"),
      sortDirection:
        sortKey === "amount"
          ? descending
            ? "descending"
            : "ascending"
          : "none",
    },
  ];
}

export function transactionTableRowKey(posting: NormalizedPosting): string {
  return posting.id;
}
