import type { ReactNode } from "react";

import { Icon } from "../../../../components/atoms/Icon/index.ts";
import { EmptyState } from "../../../../components/molecules/EmptyState/index.ts";
import { DataTable } from "../../../../components/organisms/DataTable/index.ts";
import {
  createTransactionTableColumns,
  transactionTableRowKey,
} from "./TransactionTable.helpers.tsx";
import type { TransactionTableProps } from "./TransactionTable.types.ts";

const EMPTY_TRANSACTIONS: ReactNode = (
  <EmptyState
    description="Prueba a ampliar el periodo o restablecer los filtros."
    icon={<Icon name="receipt" />}
    title="No hay movimientos"
  />
);

export function TransactionTable({
  descending,
  onSort,
  postings,
  sortKey,
}: TransactionTableProps) {
  return (
    <DataTable
      caption="Transacciones que coinciden con los filtros globales"
      columns={createTransactionTableColumns(descending, sortKey, onSort)}
      empty={EMPTY_TRANSACTIONS}
      rowKey={transactionTableRowKey}
      rows={postings}
    />
  );
}
