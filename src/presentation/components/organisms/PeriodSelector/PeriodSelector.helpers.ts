import type { SegmentedControlOption } from "../../molecules/SegmentedControl/index.ts";
import type {
  DatePeriodMode,
  DateRangeFilter,
  IsoDate,
} from "../../../../domain/analytics/types.ts";

export const PERIOD_MODE_OPTIONS: readonly SegmentedControlOption<DatePeriodMode>[] = [
  { value: "all", label: "Todo" },
  { value: "day", label: "Día" },
  { value: "week", label: "Semana", shortLabel: "Sem." },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
  { value: "custom", label: "Personalizado", shortLabel: "Rango" },
];

const PERIOD_INPUT_LABELS: Readonly<
  Record<Exclude<DatePeriodMode, "all" | "custom">, string>
> = {
  day: "Día seleccionado",
  month: "Mes seleccionado",
  week: "Semana seleccionada",
  year: "Año seleccionado",
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formattedDate(value: IsoDate): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function periodInputLabel(
  mode: Exclude<DatePeriodMode, "all" | "custom">,
): string {
  return PERIOD_INPUT_LABELS[mode];
}

export function periodInputType(
  mode: Exclude<DatePeriodMode, "all" | "custom" | "year">,
): "date" | "month" | "week" {
  return mode === "day" ? "date" : mode;
}

export function describeDateRange(dateRange: DateRangeFilter): string {
  const { from, to } = dateRange;
  if (from === null && to === null) return "Todo el historial disponible";
  if (from !== null && from === to) return formattedDate(from);
  if (from === null) return `Hasta ${formattedDate(to!)}`;
  if (to === null) return `Desde ${formattedDate(from)}`;
  return `${formattedDate(from)} – ${formattedDate(to)}`;
}

export function buildYearOptions(
  minimum: IsoDate | null,
  maximum: IsoDate,
): readonly string[] {
  const firstYear = Number((minimum ?? maximum).slice(0, 4));
  const lastYear = Number(maximum.slice(0, 4));
  const result: string[] = [];
  for (let year = lastYear; year >= firstYear; year--) result.push(String(year));
  return result;
}
