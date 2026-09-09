import type { ChartDataTableColumn, ChartDataTableRow } from "./ChartDataTable.types.ts";

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const source = typeof value === "string" && /^\s*[=+\-@]/.test(value)
    ? `'${value}`
    : String(value);
  return /[",\r\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

export function createChartCsv(
  labelHeader: string,
  columns: readonly ChartDataTableColumn[],
  rows: readonly ChartDataTableRow[],
): string {
  return [
    [labelHeader, ...columns.map(({ label }) => label)].map(csvCell).join(","),
    ...rows.map((row) => [row.label, ...row.values].map(csvCell).join(",")),
  ].join("\r\n");
}

export function downloadChartCsv(
  labelHeader: string,
  columns: readonly ChartDataTableColumn[],
  rows: readonly ChartDataTableRow[],
): void {
  const url = URL.createObjectURL(new Blob(["\uFEFF", createChartCsv(labelHeader, columns, rows)], {
    type: "text/csv;charset=utf-8",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "estadisticas-filtradas.csv";
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
