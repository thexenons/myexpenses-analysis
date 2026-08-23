import assert from "node:assert/strict";
import test from "node:test";

import {
  automaticGranularityForRange,
  dateRangeForPeriod,
  dateRangeForPeriodInput,
  isoDateFromWeekValue,
  isoDateInTimeZone,
  isoWeekValueForDate,
  periodInputValue,
  resolveTimeGranularity,
} from "../../src/domain/analytics/date-periods.ts";

const TODAY = "2026-08-23" as const;

test("selects complete calendar periods and truncates current ones at today", () => {
  assert.deepEqual(dateRangeForPeriod("day", "2026-04-12", TODAY), {
    from: "2026-04-12",
    to: "2026-04-12",
  });
  assert.deepEqual(dateRangeForPeriod("week", "2026-08-20", "2026-08-20"), {
    from: "2026-08-17",
    to: "2026-08-20",
  });
  assert.deepEqual(dateRangeForPeriod("week", "2026-08-10", TODAY), {
    from: "2026-08-10",
    to: "2026-08-16",
  });
  assert.deepEqual(dateRangeForPeriod("month", "2026-08-03", "2026-08-20"), {
    from: "2026-08-01",
    to: "2026-08-20",
  });
  assert.deepEqual(dateRangeForPeriod("year", "2025-06-03", TODAY), {
    from: "2025-01-01",
    to: "2025-12-31",
  });
  assert.deepEqual(dateRangeForPeriod("year", "2026-06-03", TODAY), {
    from: "2026-01-01",
    to: TODAY,
  });
});

test("round-trips native week, month and year input values", () => {
  assert.equal(isoWeekValueForDate("2025-12-29"), "2026-W01");
  assert.equal(isoDateFromWeekValue("2026-W01"), "2025-12-29");
  assert.equal(isoDateFromWeekValue("2025-W53"), null);
  assert.deepEqual(dateRangeForPeriodInput("week", "2026-W34", TODAY), {
    from: "2026-08-17",
    to: "2026-08-23",
  });
  assert.deepEqual(dateRangeForPeriodInput("month", "2024-02", TODAY), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(dateRangeForPeriodInput("year", "2024", TODAY), {
    from: "2024-01-01",
    to: "2024-12-31",
  });
  assert.equal(
    periodInputValue(
      "week",
      { from: "2025-12-29", to: "2026-01-04" },
      TODAY,
    ),
    "2026-W01",
  );
});

test("derives automatic chart granularity from calendar-aware inclusive ranges", () => {
  assert.equal(automaticGranularityForRange("2026-01-01", "2026-01-06"), "day");
  assert.equal(automaticGranularityForRange("2026-01-01", "2026-01-07"), "week");
  assert.equal(automaticGranularityForRange("2026-01-01", "2026-01-30"), "week");
  assert.equal(automaticGranularityForRange("2026-01-01", "2026-01-31"), "month");
  assert.equal(automaticGranularityForRange("2026-01-01", "2026-12-30"), "month");
  assert.equal(automaticGranularityForRange("2026-01-01", "2026-12-31"), "year");

  assert.equal(
    resolveTimeGranularity(
      "auto",
      "custom",
      { from: null, to: null },
      "2026-01-01",
      "2026-12-31",
    ),
    "year",
  );
  assert.equal(
    resolveTimeGranularity(
      "auto",
      "month",
      { from: "2026-08-01", to: "2026-08-23" },
      null,
      null,
    ),
    "week",
  );
  assert.equal(
    resolveTimeGranularity(
      "day",
      "year",
      { from: "2026-01-01", to: "2026-08-23" },
      null,
      null,
    ),
    "day",
  );
  assert.equal(
    resolveTimeGranularity(
      "auto",
      "custom",
      { from: "2026-08-23", to: null },
      "2020-01-01",
      "2026-08-22",
    ),
    "day",
  );
});

test("reads the current calendar date in Europe/Madrid", () => {
  assert.equal(
    isoDateInTimeZone(new Date("2026-08-22T22:30:00Z")),
    "2026-08-23",
  );
});
