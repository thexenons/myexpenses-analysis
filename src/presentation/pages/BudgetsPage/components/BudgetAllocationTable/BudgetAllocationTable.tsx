import { useMemo } from "react";

import { flattenBudgetAllocationNodes } from "../../../../../domain/analytics/budgets.ts";
import { DataTable } from "../../../../components/organisms/DataTable/DataTable.tsx";
import { createBudgetAllocationColumns } from "./BudgetAllocationTable.helpers.tsx";
import styles from "./BudgetAllocationTable.module.css";
import type { BudgetAllocationTableProps } from "./BudgetAllocationTable.types.ts";

export function BudgetAllocationTable({
  allocations,
  currency,
  fractionDigits,
}: BudgetAllocationTableProps) {
  const rows = useMemo(
    () => flattenBudgetAllocationNodes(allocations),
    [allocations],
  );
  const columns = useMemo(
    () => createBudgetAllocationColumns(currency, fractionDigits),
    [currency, fractionDigits],
  );

  return (
    <DataTable
      caption="Asignaciones jerárquicas del presupuesto"
      className={styles.table}
      columns={columns}
      empty="Este periodo no tiene asignaciones por categoría."
      rowKey={(row) => row.id}
      rows={rows}
    />
  );
}
