import { PeriodSelectorView } from "./PeriodSelector.view.tsx";
import type { PeriodSelectorProps } from "./PeriodSelector.types.ts";
import { usePeriodSelector } from "./hooks/PeriodSelector.hooks.ts";

export function PeriodSelector(props: PeriodSelectorProps) {
  return <PeriodSelectorView {...usePeriodSelector(props)} />;
}
