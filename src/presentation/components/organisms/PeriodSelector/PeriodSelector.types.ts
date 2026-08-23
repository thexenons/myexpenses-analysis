import type {
  DatePeriodMode,
  DateRangeFilter,
} from "../../../../domain/analytics/types.ts";

export type PeriodSelectorVariant = "compact" | "expanded";
export type PeriodSelectorDateBoundary = "from" | "to";

export interface PeriodSelectorProps {
  readonly className?: string;
  readonly variant?: PeriodSelectorVariant;
}

export interface PeriodSelectorViewProps extends PeriodSelectorProps {
  readonly customMax: string;
  readonly customMin?: string;
  readonly customDateRange: DateRangeFilter;
  readonly inputMax?: string;
  readonly inputMin?: string;
  readonly inputValue: string;
  readonly onCustomDateChange: (
    boundary: PeriodSelectorDateBoundary,
    value: string,
  ) => void;
  readonly onModeChange: (mode: DatePeriodMode) => void;
  readonly onPeriodValueChange: (value: string) => void;
  readonly periodMode: DatePeriodMode;
  readonly rangeDescription: string;
  readonly yearOptions: readonly string[];
}
