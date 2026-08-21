import type { ReactNode, Ref } from "react";

import type { ValueFormatter } from "../../../utils/component.helpers.ts";
import type { ChartBarDatum } from "../chart/chart.types.ts";

export type { ChartBarDatum } from "../chart/chart.types.ts";

export interface HorizontalBarChartProps {
  readonly className?: string;
  readonly data: readonly ChartBarDatum[];
  readonly description?: string;
  readonly emptyMessage?: ReactNode;
  readonly formatLabel?: (label: string) => string;
  readonly formatValue?: Intl.NumberFormat | ValueFormatter;
  readonly labelHeader?: string;
  readonly ref?: Ref<HTMLElement>;
  readonly title: string;
  readonly tooltipFormatter?: (datum: ChartBarDatum) => string;
}
