import type {
  TimeGranularity,
  TimeGranularitySetting,
} from "../../../../domain/analytics/types.ts";
import type { SegmentedControlOption } from "../../molecules/SegmentedControl/index.ts";

export const GRANULARITY_OPTIONS: readonly SegmentedControlOption<TimeGranularitySetting>[] = [
  { value: "auto", label: "Automática", shortLabel: "Auto" },
  { value: "day", label: "Día" },
  { value: "week", label: "Semana", shortLabel: "Sem." },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

export const GRANULARITY_LABELS: Readonly<Record<TimeGranularity, string>> = {
  day: "día",
  month: "mes",
  week: "semana",
  year: "año",
};
