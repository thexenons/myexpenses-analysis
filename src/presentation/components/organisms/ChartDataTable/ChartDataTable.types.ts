import type { ValueFormatter } from "../../../utils/component.helpers.ts";

export interface ChartDataTableColumn {
  readonly id: string;
  readonly label: string;
}

export interface ChartDataTableRow {
  readonly id: string;
  readonly label: string;
  readonly values: readonly (number | null)[];
}

export interface ChartDataTableProps {
  readonly caption: string;
  readonly columns: readonly ChartDataTableColumn[];
  readonly formatLabel?: (label: string) => string;
  readonly formatValue?: Intl.NumberFormat | ValueFormatter;
  readonly labelHeader: string;
  readonly rows:
    | readonly ChartDataTableRow[]
    | (() => readonly ChartDataTableRow[]);
  readonly summary?: string;
}
