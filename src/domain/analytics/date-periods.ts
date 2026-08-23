import { addIsoDays, monthPeriodForDate, weekPeriodForDate } from "./periods.ts";
import type {
  DatePeriodMode,
  DateRangeFilter,
  IsoDate,
  TimeGranularity,
  TimeGranularitySetting,
} from "./types.ts";
import { assertIsoDate } from "./validation.ts";

const ISO_MONTH_PATTERN = /^(\d{4})-(\d{2})$/u;
const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{2})$/u;
const ISO_YEAR_PATTERN = /^\d{4}$/u;
const DAY_MILLISECONDS = 86_400_000;

function utcDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

function dateFromIso(value: IsoDate): Date {
  return utcDate(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}

function isoFromDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10) as IsoDate;
}

function isoWeekday(value: Date): number {
  return value.getUTCDay() === 0 ? 7 : value.getUTCDay();
}

function startOfIsoWeek(value: Date): Date {
  return new Date(
    value.getTime() - (isoWeekday(value) - 1) * DAY_MILLISECONDS,
  );
}

function addCalendarMonths(date: IsoDate, months: number): IsoDate {
  const value = dateFromIso(date);
  const day = value.getUTCDate();
  const targetFirst = utcDate(
    value.getUTCFullYear(),
    value.getUTCMonth() + months,
    1,
  );
  const targetLast = utcDate(
    targetFirst.getUTCFullYear(),
    targetFirst.getUTCMonth() + 1,
    0,
  );
  return isoFromDate(
    utcDate(
      targetFirst.getUTCFullYear(),
      targetFirst.getUTCMonth(),
      Math.min(day, targetLast.getUTCDate()),
    ),
  );
}

function addCalendarYears(date: IsoDate, years: number): IsoDate {
  const value = dateFromIso(date);
  const targetYear = value.getUTCFullYear() + years;
  const targetMonth = value.getUTCMonth();
  const lastDay = utcDate(targetYear, targetMonth + 1, 0).getUTCDate();
  return isoFromDate(
    utcDate(targetYear, targetMonth, Math.min(value.getUTCDate(), lastDay)),
  );
}

function currentPeriodEnd(
  endDate: IsoDate,
  startDate: IsoDate,
  today: IsoDate,
): IsoDate {
  return startDate <= today && today <= endDate ? today : endDate;
}

export function isoDateInTimeZone(
  date: Date,
  timeZone = "Europe/Madrid",
): IsoDate {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return assertIsoDate(
    `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    "Current date",
  );
}

export function isoWeekValueForDate(date: IsoDate): string {
  const value = dateFromIso(date);
  const thursday = new Date(
    value.getTime() + (4 - isoWeekday(value)) * DAY_MILLISECONDS,
  );
  const weekYear = thursday.getUTCFullYear();
  const weekOneMonday = startOfIsoWeek(utcDate(weekYear, 0, 4));
  const weekNumber =
    Math.floor(
      (value.getTime() - weekOneMonday.getTime()) /
        (7 * DAY_MILLISECONDS),
    ) + 1;
  return `${String(weekYear).padStart(4, "0")}-W${String(weekNumber).padStart(2, "0")}`;
}

export function isoDateFromWeekValue(value: string): IsoDate | null {
  const match = ISO_WEEK_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (year < 1 || week < 1 || week > 53) return null;
  const weekOneMonday = startOfIsoWeek(utcDate(year, 0, 4));
  const result = isoFromDate(
    new Date(weekOneMonday.getTime() + (week - 1) * 7 * DAY_MILLISECONDS),
  );
  return isoWeekValueForDate(result) === value ? result : null;
}

export function dateRangeForPeriod(
  mode: Exclude<DatePeriodMode, "all" | "custom">,
  anchor: IsoDate,
  today: IsoDate,
): DateRangeFilter {
  assertIsoDate(anchor, "Period anchor");
  assertIsoDate(today, "Current date");
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "week") {
    const period = weekPeriodForDate(anchor, 1);
    return {
      from: period.startDate,
      to: currentPeriodEnd(period.endDate, period.startDate, today),
    };
  }
  if (mode === "month") {
    const period = monthPeriodForDate(anchor, 1);
    return {
      from: period.startDate,
      to: currentPeriodEnd(period.endDate, period.startDate, today),
    };
  }
  const year = anchor.slice(0, 4);
  const from = `${year}-01-01` as IsoDate;
  const endDate = `${year}-12-31` as IsoDate;
  return { from, to: currentPeriodEnd(endDate, from, today) };
}

export function dateRangeForPeriodInput(
  mode: Exclude<DatePeriodMode, "all" | "custom">,
  value: string,
  today: IsoDate,
): DateRangeFilter | null {
  if (mode === "day") {
    try {
      const date = assertIsoDate(value, "Selected day");
      return dateRangeForPeriod(mode, date, today);
    } catch {
      return null;
    }
  }
  if (mode === "week") {
    const date = isoDateFromWeekValue(value);
    return date === null ? null : dateRangeForPeriod(mode, date, today);
  }
  if (mode === "month") {
    const match = ISO_MONTH_PATTERN.exec(value);
    if (
      match === null ||
      Number(match[1]) < 1 ||
      Number(match[2]) < 1 ||
      Number(match[2]) > 12
    ) {
      return null;
    }
    return dateRangeForPeriod(mode, `${value}-01` as IsoDate, today);
  }
  if (!ISO_YEAR_PATTERN.test(value) || Number(value) < 1) return null;
  return dateRangeForPeriod(mode, `${value}-01-01` as IsoDate, today);
}

export function periodInputValue(
  mode: Exclude<DatePeriodMode, "all" | "custom">,
  dateRange: DateRangeFilter,
  fallback: IsoDate,
): string {
  const anchor = dateRange.from ?? dateRange.to ?? fallback;
  if (mode === "day") return anchor;
  if (mode === "week") return isoWeekValueForDate(anchor);
  if (mode === "month") return anchor.slice(0, 7);
  return anchor.slice(0, 4);
}

export function automaticGranularityForRange(
  from: IsoDate,
  to: IsoDate,
): TimeGranularity {
  assertIsoDate(from, "Automatic granularity start");
  assertIsoDate(to, "Automatic granularity end");
  if (from > to) throw new Error("Automatic granularity range is reversed");
  const endExclusive = addIsoDays(to, 1);
  if (endExclusive < addIsoDays(from, 7)) return "day";
  if (endExclusive < addCalendarMonths(from, 1)) return "week";
  if (endExclusive < addCalendarYears(from, 1)) return "month";
  return "year";
}

export function resolveTimeGranularity(
  setting: TimeGranularitySetting,
  periodMode: DatePeriodMode,
  dateRange: DateRangeFilter,
  datasetMinDate: IsoDate | null,
  datasetMaxDate: IsoDate | null,
): TimeGranularity {
  if (setting !== "auto") return setting;
  if (periodMode === "day" || periodMode === "week") return "day";
  if (periodMode === "month") return "week";
  if (periodMode === "year") return "month";
  const from = dateRange.from ?? datasetMinDate;
  const to = dateRange.to ?? datasetMaxDate;
  if (from === null || to === null) return "month";
  if (from <= to) return automaticGranularityForRange(from, to);
  const onlyExplicitBoundary = dateRange.from ?? dateRange.to;
  return onlyExplicitBoundary === null
    ? "month"
    : automaticGranularityForRange(onlyExplicitBoundary, onlyExplicitBoundary);
}
