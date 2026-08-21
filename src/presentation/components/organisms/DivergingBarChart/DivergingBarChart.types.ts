import type { ReactNode, Ref } from "react";

import type { ValueFormatter } from "../../../utils/component.helpers.ts";
import type { DivergingBarDatum } from "../chart/chart.types.ts";

export type { DivergingBarDatum } from "../chart/chart.types.ts";

export interface DivergingBarChartProps {
  readonly className?: string;
  readonly data: readonly DivergingBarDatum[];
  readonly description?: string;
  readonly emptyMessage?: ReactNode;
  readonly formatLabel?: (label: string) => string;
  readonly formatValue?: Intl.NumberFormat | ValueFormatter;
  readonly leftColor?: string;
  readonly leftLabel: string;
  readonly ref?: Ref<HTMLElement>;
  readonly rightColor?: string;
  readonly rightLabel: string;
  readonly title: string;
}
