import { useCallback, useMemo } from "react";

import {
  dateRangeForPeriod,
  dateRangeForPeriodInput,
  isoDateInTimeZone,
  periodInputValue,
} from "../../../../../domain/analytics/date-periods.ts";
import type {
  DatePeriodMode,
  DateRangeFilter,
  IsoDate,
} from "../../../../../domain/analytics/types.ts";
import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts";
import {
  buildYearOptions,
  describeDateRange,
} from "../PeriodSelector.helpers.ts";
import type {
  PeriodSelectorDateBoundary,
  PeriodSelectorProps,
  PeriodSelectorViewProps,
} from "../PeriodSelector.types.ts";

function laterDate(left: IsoDate, right: IsoDate | null): IsoDate {
  return right !== null && right > left ? right : left;
}

function normalizeCustomDateRange(
  current: DateRangeFilter,
  boundary: PeriodSelectorDateBoundary,
  value: string,
): DateRangeFilter {
  const selected = value === "" ? null : (value as IsoDate);
  let from = boundary === "from" ? selected : current.from;
  let to = boundary === "to" ? selected : current.to;
  if (from !== null && to !== null && from > to) {
    if (boundary === "from") to = from;
    else from = to;
  }
  return { from, to };
}

export function usePeriodSelector({
  className,
  variant = "expanded",
}: PeriodSelectorProps): PeriodSelectorViewProps {
  const analytics = useAppStore((state) => state.analytics);
  const dateRange = useAppStore((state) => state.filters.dateRange);
  const periodMode = useAppStore((state) => state.filters.periodMode);
  const setDatePeriod = useAppStore((state) => state.actions.setDatePeriod);
  const timeZone = analytics?.backup?.preferences.timeZone ?? "Europe/Madrid";
  const today = isoDateInTimeZone(new Date(), timeZone);
  const maximum = laterDate(today, analytics?.maxDate ?? null);
  const fallback = dateRange.to ?? dateRange.from ?? today;
  const presetMode =
    periodMode === "all" || periodMode === "custom" ? null : periodMode;
  const inputValue =
    presetMode === null ? "" : periodInputValue(presetMode, dateRange, fallback);
  const inputMin =
    presetMode === null || analytics?.minDate === null || analytics === null
      ? undefined
      : periodInputValue(
          presetMode,
          { from: analytics.minDate, to: analytics.minDate },
          analytics.minDate,
        );
  const inputMax =
    presetMode === null
      ? undefined
      : periodInputValue(
          presetMode,
          { from: maximum, to: maximum },
          maximum,
        );
  const onModeChange = useCallback(
    (mode: DatePeriodMode) => {
      if (mode === "all") {
        setDatePeriod(mode, { from: null, to: null });
        return;
      }
      if (mode === "custom") {
        setDatePeriod(mode, dateRange);
        return;
      }
      const anchor = dateRange.to ?? dateRange.from ?? today;
      setDatePeriod(mode, dateRangeForPeriod(mode, anchor, today));
    },
    [dateRange, setDatePeriod, today],
  );
  const onPeriodValueChange = useCallback(
    (value: string) => {
      if (presetMode === null) return;
      const next = dateRangeForPeriodInput(presetMode, value, today);
      if (next !== null) setDatePeriod(presetMode, next);
    },
    [presetMode, setDatePeriod, today],
  );
  const onCustomDateChange = useCallback(
    (boundary: PeriodSelectorDateBoundary, value: string) =>
      setDatePeriod(
        "custom",
        normalizeCustomDateRange(dateRange, boundary, value),
      ),
    [dateRange, setDatePeriod],
  );
  const yearOptions = useMemo(
    () => buildYearOptions(analytics?.minDate ?? null, maximum),
    [analytics?.minDate, maximum],
  );

  return {
    className,
    customMax: maximum,
    customMin: analytics?.minDate ?? undefined,
    customDateRange: dateRange,
    inputMax,
    inputMin,
    inputValue,
    onCustomDateChange,
    onModeChange,
    onPeriodValueChange,
    periodMode,
    rangeDescription: describeDateRange(dateRange),
    variant,
    yearOptions,
  };
}
