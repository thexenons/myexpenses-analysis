import type { HTMLAttributes, Ref } from "react";

import type { ValueFormatter } from "../../../utils/component.helpers.ts";
import type { ChartLegendItem } from "../chart/chart.types.ts";

export type { ChartLegendItem } from "../chart/chart.types.ts";

export interface ChartLegendProps extends HTMLAttributes<HTMLUListElement> {
  readonly items: readonly ChartLegendItem[];
  readonly hiddenItemIds?: ReadonlySet<string>;
  readonly onToggleItem?: (id: string) => void;
  readonly valueFormatter?: Intl.NumberFormat | ValueFormatter;
  readonly ref?: Ref<HTMLUListElement>;
}
