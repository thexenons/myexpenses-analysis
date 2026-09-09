import { resolvePostingAccounts } from "../../../../../domain/analytics/transfer-relations.ts";
import type { AnalyticsDataset, NormalizedPosting } from "../../../../../domain/analytics/types.ts";
import type { DataTableColumn } from "../../../../components/organisms/DataTable/index.ts";
import { formatDate } from "../../../../utils/format.ts";
import type { TransactionSortKey } from "../../TransactionsPage.types.ts";
import { TransactionAccount } from "../TransactionAccount/index.ts";
import { TransactionAmount } from "../TransactionAmount/index.ts";
import { TransactionConcept } from "../TransactionConcept/index.ts";
import { TransactionStatus } from "../TransactionStatus/index.ts";
import { TransactionLinks } from "../TransactionLinks/index.ts";

export function createTransactionTableColumns(
  descending: boolean,
  sortKey: TransactionSortKey,
  onSort: (key: TransactionSortKey) => void,
  dataset?: AnalyticsDataset,
  dateBasis: "operation" | "value" = "operation",
): readonly DataTableColumn<NormalizedPosting>[] {
  return [
    {
      key: "date",
      header: dateBasis === "value" ? "Fecha valor" : "Fecha",
      cell: (posting) =>
        dateBasis === "value"
          ? `${formatDate(posting.valueDate ?? posting.date)}${posting.valueDate === undefined ? " · operación" : ""}`
          : `${formatDate(posting.date)}${posting.localTime ? ` · ${posting.localTime.slice(0, 5)}` : ""}`,
      onSort: () => onSort("date"),
      sortDirection:
        sortKey === "date" ? (descending ? "descending" : "ascending") : "none",
    },
    {
      key: "concept",
      header: "Concepto",
      cell: (posting) => <>
        <TransactionConcept posting={posting} />
        {dataset === undefined ? null : <TransactionLinks dataset={dataset} posting={posting} />}
      </>,
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
      key: "origin",
      header: "Cuenta de origen",
      cell: (posting) => dataset === undefined ? "—" : resolvePostingAccounts(posting, dataset).originAccount?.label ?? "Externa o sin vincular",
    },
    {
      key: "destination",
      header: "Cuenta de destino",
      cell: (posting) => dataset === undefined ? "—" : resolvePostingAccounts(posting, dataset).destinationAccount?.label ?? "Externa o sin vincular",
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
