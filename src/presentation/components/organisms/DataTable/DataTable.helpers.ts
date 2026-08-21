import type {
  DataTableAlignment,
  DataTableColumn,
} from "./DataTable.types"

export function dataTableAlignment<Row>(
  column: DataTableColumn<Row>,
): DataTableAlignment {
  return column.align ?? "start"
}

export function dataTableEmptyColumnSpan<Row>(
  columns: ReadonlyArray<DataTableColumn<Row>>,
): number {
  return Math.max(columns.length, 1)
}
