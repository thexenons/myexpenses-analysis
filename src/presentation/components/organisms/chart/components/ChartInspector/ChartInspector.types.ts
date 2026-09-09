import type { Ref } from "react";
import type { ValueFormatter } from "../../../../../utils/component.helpers.ts";

export interface ChartInspectorValue {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly color?: string;
  readonly detail?: string;
}

export interface ChartInspectorHandle {
  inspect(id: string, x: number, y: number): void;
  dismiss(): void;
}

export interface ChartInspectorProps {
  readonly title: string;
  readonly items: readonly { readonly id: string; readonly label: string }[];
  readonly getValues: (id: string) => readonly ChartInspectorValue[];
  readonly formatLabel?: (label: string) => string;
  readonly formatValue?: Intl.NumberFormat | ValueFormatter;
  readonly ref?: Ref<ChartInspectorHandle>;
}
