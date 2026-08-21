import type { HTMLAttributes, Key, ReactNode, Ref } from "react"

export type DataTableAlignment = "start" | "center" | "end"
export type DataTableSortDirection = "ascending" | "descending" | "none"

export interface DataTableColumn<Row> {
  align?: DataTableAlignment
  cell: (row: Row, rowIndex: number) => ReactNode
  cellClassName?: string
  header: ReactNode
  headerClassName?: string
  key: string
  onSort?: () => void
  rowHeader?: boolean
  sortDirection?: DataTableSortDirection
}

export interface DataTableProps<Row>
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  caption?: ReactNode
  columns: ReadonlyArray<DataTableColumn<Row>>
  empty?: ReactNode
  rowKey: (row: Row, rowIndex: number) => Key
  rows: ReadonlyArray<Row>
  ref?: Ref<HTMLDivElement>
}
