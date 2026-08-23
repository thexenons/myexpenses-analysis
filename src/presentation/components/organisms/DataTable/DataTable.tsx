/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The named overflow region must receive focus so keyboard users can pan the table. */
import { useId } from "react"

import styles from "./DataTable.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import {
  dataTableAlignment,
  dataTableEmptyColumnSpan,
} from "./DataTable.helpers"
import type { DataTableProps } from "./DataTable.types"

export function DataTable<Row>({
  caption,
  className,
  columns,
  empty = "No hay datos para los filtros seleccionados.",
  ref,
  rowKey,
  rows,
  ...props
}: DataTableProps<Row>) {
  const captionId = useId()
  const hasCaption = Boolean(caption)

  return (
    <div
      {...props}
      className={cx(styles.root, className)}
      ref={ref}
    >
      <section
        aria-label={hasCaption ? undefined : "Tabla desplazable"}
        aria-labelledby={hasCaption ? captionId : undefined}
        className={styles.scroller}
        tabIndex={0}
      >
        <table className={styles.table}>
          {hasCaption ? (
            <caption className={styles.caption} id={captionId}>
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  aria-sort={column.sortDirection}
                  className={cx(
                    styles.header,
                    styles[dataTableAlignment(column)],
                    column.headerClassName,
                  )}
                  key={column.key}
                  scope="col"
                >
                  {column.onSort ? (
                    <button
                      className={styles.sort}
                      onClick={column.onSort}
                      type="button"
                    >
                      <span>{column.header}</span>
                      <span
                        aria-hidden="true"
                        className={cx(
                          styles.sortIndicator,
                          column.sortDirection &&
                            styles[column.sortDirection],
                        )}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr className={styles.row} key={rowKey(row, rowIndex)}>
                  {columns.map((column) => {
                    const cellClassName = cx(
                      styles.cell,
                      styles[dataTableAlignment(column)],
                      column.rowHeader && styles.rowHeader,
                      column.cellClassName,
                    )
                    const content = column.cell(row, rowIndex)

                    return column.rowHeader ? (
                      <th
                        className={cellClassName}
                        key={column.key}
                        scope="row"
                      >
                        {content}
                      </th>
                    ) : (
                      <td className={cellClassName} key={column.key}>
                        {content}
                      </td>
                    )
                  })}
                </tr>
              ))
            ) : (
              <tr className={cx(styles.row, styles.emptyRow)}>
                <td
                  className={styles.empty}
                  colSpan={dataTableEmptyColumnSpan(columns)}
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
