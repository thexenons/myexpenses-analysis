import type { IsoDate } from "./types.ts";

const DAY_MILLISECONDS = 86_400_000;

export interface CalendarPeriodRange {
  readonly endDate: IsoDate;
  readonly key: string;
  readonly startDate: IsoDate;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

function isoFromDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate;
}

function dateFromIso(date: IsoDate): Date {
  return utcDate(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function assertDayPreference(value: number, maximum: number, context: string): void {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${context} must be an integer from 1 through ${maximum}`);
  }
}

function monthLabelStart(
  year: number,
  monthIndex: number,
  monthStart: number,
): Date {
  const endOfMonth = utcDate(year, monthIndex + 1, 0);
  return monthStart > endOfMonth.getUTCDate()
    ? utcDate(year, monthIndex + 1, 1)
    : utcDate(year, monthIndex, monthStart);
}

export function addIsoDays(date: IsoDate, days: number): IsoDate {
  return isoFromDate(
    new Date(dateFromIso(date).getTime() + days * DAY_MILLISECONDS),
  );
}

export function monthPeriodForLabel(
  year: number,
  monthIndex: number,
  monthStart: number,
): CalendarPeriodRange {
  assertDayPreference(monthStart, 31, "monthStart");
  if (!Number.isInteger(year) || year < 1 || monthIndex < 0 || monthIndex > 11) {
    throw new Error("Month period label is invalid");
  }
  const start = monthLabelStart(year, monthIndex, monthStart);
  const nextStart = monthLabelStart(year, monthIndex + 1, monthStart);
  return {
    key: `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`,
    startDate: isoFromDate(start),
    endDate: isoFromDate(new Date(nextStart.getTime() - DAY_MILLISECONDS)),
  };
}

export function monthPeriodForDate(
  date: IsoDate,
  monthStart: number,
): CalendarPeriodRange {
  const value = dateFromIso(date);
  let year = value.getUTCFullYear();
  let monthIndex = value.getUTCMonth();
  if (value < monthLabelStart(year, monthIndex, monthStart)) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      year -= 1;
      monthIndex = 11;
    }
  }
  return monthPeriodForLabel(year, monthIndex, monthStart);
}

function startOfWeek(date: Date, weekStart: number): Date {
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return new Date(
    date.getTime() - ((isoWeekday - weekStart + 7) % 7) * DAY_MILLISECONDS,
  );
}

export function weekPeriodForDate(
  date: IsoDate,
  weekStart: number,
): CalendarPeriodRange {
  assertDayPreference(weekStart, 7, "weekStart");
  const start = startOfWeek(dateFromIso(date), weekStart);
  // MyExpenses uses YEAR_OF_WEEK_START: the civil year/day ordinal of the
  // configured week start. This is deliberately not ISO-8601 week-year logic.
  const weekYear = start.getUTCFullYear();
  const firstDay = utcDate(weekYear, 0, 1);
  const dayOfYear =
    Math.floor((start.getTime() - firstDay.getTime()) / DAY_MILLISECONDS) + 1;
  const weekNumber =
    Math.floor((dayOfYear - 1) / 7) + 1;
  return {
    key: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
    startDate: isoFromDate(start),
    endDate: isoFromDate(
      new Date(start.getTime() + 6 * DAY_MILLISECONDS),
    ),
  };
}
