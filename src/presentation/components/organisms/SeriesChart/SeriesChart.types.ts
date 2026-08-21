import type { ReactNode, Ref } from "react";

import type { ValueFormatter } from "../../../utils/component.helpers.ts";
import type { ChartPoint, ChartSeries } from "../chart/chart.types.ts";

export interface SeriesChartBaseProps {
  readonly className?: string;
  readonly description?: string;
  readonly emptyMessage?: ReactNode;
  readonly formatLabel?: (label: string) => string;
  readonly formatValue?: Intl.NumberFormat | ValueFormatter;
  readonly ref?: Ref<HTMLElement>;
  readonly series: readonly ChartSeries[];
  readonly title: string;
  readonly tooltipFormatter?: (point: ChartPoint, series: ChartSeries) => string;
}

export interface SeriesChartProps extends SeriesChartBaseProps {
  readonly variant: "line" | "area";
}
