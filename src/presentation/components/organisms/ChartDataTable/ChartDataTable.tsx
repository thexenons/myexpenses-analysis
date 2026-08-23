/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The named overflow region must receive focus so keyboard users can pan the exact-data table. */
import { useMemo } from "react";

import { formatNumber } from "../../../utils/component.helpers.ts";
import styles from "./ChartDataTable.module.css";
import type { ChartDataTableProps } from "./ChartDataTable.types.ts";
import { useChartDataTable } from "./hooks/ChartDataTable.hooks.ts";

function identityLabel(label: string): string {
  return label;
}

export function ChartDataTable({
  caption,
  columns,
  formatLabel = identityLabel,
  formatValue,
  labelHeader,
  rows,
  summary = "Ver datos exactos",
}: ChartDataTableProps) {
  const { onToggle, open } = useChartDataTable();
  const resolvedRows = useMemo(
    () => (open ? (typeof rows === "function" ? rows() : rows) : []),
    [open, rows],
  );

  return (
    <details
      className={styles.root}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      open={open}
    >
      <summary className={styles.summary}>{summary}</summary>
      {open ? (
        <section
          aria-label={`Tabla: ${caption}`}
          className={styles.scroller}
          tabIndex={0}
        >
          <table className={styles.table}>
            <caption className={styles.caption}>{caption}</caption>
            <thead>
              <tr>
                <th className={styles.header} scope="col">
                  {labelHeader}
                </th>
                {columns.map((column) => (
                  <th className={styles.header} key={column.id} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resolvedRows.map((row) => (
                <tr className={styles.row} key={row.id}>
                  <th className={styles.rowHeader} scope="row">
                    {formatLabel(row.label)}
                  </th>
                  {row.values.map((value, index) => (
                    <td className={styles.value} key={columns[index]?.id ?? index}>
                      {value === null ? "—" : formatNumber(value, formatValue)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </details>
  );
}
