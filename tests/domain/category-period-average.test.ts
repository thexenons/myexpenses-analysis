import assert from "node:assert/strict";
import test from "node:test";

import { aggregateCategoryBreakdown } from "../../src/domain/analytics/aggregations.ts";
import { aggregateCategoryPeriodAverages } from "../../src/domain/analytics/category-period-average.ts";
import { resolveTimeGranularity } from "../../src/domain/analytics/date-periods.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import type { AnalyticsDataset, FilterState, IsoDate } from "../../src/domain/analytics/types.ts";

type Entry = readonly [id: string, date: IsoDate, amount: number, category?: readonly string[]];

function dataset(entries: readonly Entry[]): AnalyticsDataset {
  return normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: {
      Expenses: { categoryType: "EXPENSE", children: { Food: { categoryType: "EXPENSE" }, Rent: { categoryType: "EXPENSE" } } },
    },
    parsedData: [{
      uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0,
      transactions: entries.map(([uuid, date, amount, category]) => ({
        uuid, date, amount, category: category ?? ["Expenses", "Food"],
        sourceTransactionUuid: uuid, sourceStatus: "RECONCILED" as const,
        splitIndex: null, splitCount: null,
      })),
    }],
  });
}

function filtered(source: AnalyticsDataset, from: IsoDate | null, to: IsoDate | null, rest: Partial<FilterState> = {}) {
  return applyFilters(source, {
    ...createDefaultFilterState(),
    ...rest,
    dateRange: { from, to },
  });
}

const foodId = '["Expenses","Food"]';
const rentId = '["Expenses","Rent"]';
const rootId = '["Expenses"]';

test("complete calendar year uses twelve months including zero-activity months", () => {
  const data = filtered(dataset([["jan", "2025-01-10", -1200]]), "2025-01-01", "2025-12-31");
  const result = aggregateCategoryPeriodAverages(data, "month", "2026-09-27");
  assert.equal(result.completedPeriodCount, 12);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), -10_000);
  assert.equal(result.averageEurMinorByCategoryId.get(rootId), -10_000);
  assert.equal(aggregateCategoryBreakdown(data)[0]?.summary.netEurMinor, -120_000);
});

test("year to date excludes September from numerator and divisor but preserves totals", () => {
  const data = filtered(dataset([
    ["jan", "2026-01-10", -800],
    ["september", "2026-09-10", -900],
  ]), "2026-01-01", "2026-09-27");
  const granularity = resolveTimeGranularity("auto", "year", data.filters.dateRange, data.source.minDate, data.source.maxDate);
  assert.equal(granularity, "month");
  const result = aggregateCategoryPeriodAverages(data, granularity, "2026-09-27");
  assert.equal(result.completedPeriodCount, 8);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), -10_000);
  assert.equal(aggregateCategoryBreakdown(data)[0]?.summary.netEurMinor, -170_000);
});

test("future dates do not become completed units or enter the numerator", () => {
  const data = filtered(dataset([
    ["past", "2026-01-10", -800],
    ["current", "2026-09-10", -900],
    ["future", "2026-10-10", -700],
  ]), "2026-01-01", "2026-12-31");
  const result = aggregateCategoryPeriodAverages(data, "month", "2026-09-27");
  assert.equal(result.completedPeriodCount, 8);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), -10_000);
  assert.equal(aggregateCategoryBreakdown(data)[0]?.summary.netEurMinor, -240_000);
});

test("September weeks omit both crossing boundaries and the current incomplete week", () => {
  const data = filtered(dataset([
    ["crossing", "2026-09-01", -100],
    ["full", "2026-09-08", -200],
    ["empty-week-neighbor", "2026-09-27", -300],
  ]), "2026-09-01", "2026-09-27");
  const result = aggregateCategoryPeriodAverages(data, "week", "2026-09-27");
  assert.equal(result.completedPeriodCount, 2);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), -10_000);
  assert.equal(aggregateCategoryBreakdown(data)[0]?.summary.netEurMinor, -60_000);
});

test("no completed period returns null even when the category has activity", () => {
  const data = filtered(dataset([["today", "2026-09-27", -50]]), "2026-09-27", "2026-09-27");
  const result = aggregateCategoryPeriodAverages(data, "day", "2026-09-27");
  assert.equal(result.completedPeriodCount, 0);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), undefined);
});

test("day and year units follow resolved granularity, not the period selector label", () => {
  const source = dataset([["first", "2025-01-01", -10], ["last", "2025-12-31", -20]]);
  const data = filtered(source, "2025-01-01", "2025-12-31");
  const daily = aggregateCategoryPeriodAverages(data, "day", "2026-09-27");
  assert.equal(daily.completedPeriodCount, 365);
  assert.equal(daily.averageEurMinorByCategoryId.get(foodId), -3_000 / 365);
  const yearly = aggregateCategoryPeriodAverages(data, "year", "2026-09-27");
  assert.equal(yearly.completedPeriodCount, 1);
  assert.equal(yearly.averageEurMinorByCategoryId.get(foodId), -3_000);
});

test("open range uses common dataset coverage, never category-local padded boundaries", () => {
  const source = dataset([
    ["coverage-start", "2025-01-15", -10, ["Expenses", "Rent"]],
    ["food", "2025-02-10", -20],
    ["coverage-end", "2025-03-10", -10, ["Expenses", "Rent"]],
  ]);
  const data = filtered(source, null, null);
  const result = aggregateCategoryPeriodAverages(data, "month", "2026-09-27");
  assert.equal(result.completedPeriodCount, 1);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), -2_000);
  assert.equal(result.averageEurMinorByCategoryId.get(rentId), undefined);
  assert.equal(result.averageEurMinorByCategoryId.get(rootId), -2_000);
});

test("value-date filtering and open coverage use value dates", () => {
  const initial = dataset([
    ["outside", "2025-01-31", -20],
    ["inside", "2025-02-28", -40],
  ]);
  const source = structuredClone(initial);
  for (const posting of source.postings) {
    Object.assign(posting, {
      valueDate: posting.transactionId === "outside" ? "2025-02-01" : "2025-03-01",
    });
  }
  const data = filtered(source, "2025-02-01", "2025-02-28", { dateBasis: "value" });
  const result = aggregateCategoryPeriodAverages(data, "month", "2026-09-27");
  assert.equal(data.activePostings.length, 1);
  assert.equal(result.completedPeriodCount, 1);
  assert.equal(result.averageEurMinorByCategoryId.get(foodId), -2_000);
  const open = aggregateCategoryPeriodAverages(filtered(source, null, null, { dateBasis: "value" }), "month", "2026-09-27");
  assert.equal(open.completedPeriodCount, 1); // February is wholly inside value-date coverage.
  assert.equal(open.averageEurMinorByCategoryId.get(foodId), -2_000);
});

test("configured month and week starts define complete accounting units", () => {
  const base = dataset([["first", "2026-09-10", -40], ["second", "2026-09-21", -60]]);
  const source = {
    ...base,
    backup: {
      source: { format: "myexpenses-backup" as const, schemaVersion: 189, backupSha256: "a".repeat(64), databaseSha256: "b".repeat(64) },
      preferences: { homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 15, weekStart: 2, includeTransfers: false },
      currencies: [], accounts: [], categories: [], payees: [], paymentMethods: [], tags: [], budgets: [],
    },
  } satisfies AnalyticsDataset;
  const month = aggregateCategoryPeriodAverages(filtered(source, "2026-09-01", "2026-10-20"), "month", "2026-10-20");
  assert.equal(month.completedPeriodCount, 1); // Sep 15–Oct 14; only the Sep 21 posting.
  assert.equal(month.averageEurMinorByCategoryId.get(foodId), -6_000);
  const week = aggregateCategoryPeriodAverages(filtered(source, "2026-09-01", "2026-09-27"), "week", "2026-09-27");
  assert.equal(week.completedPeriodCount, 3); // Tue–Mon weeks ending Sep 7, 14, and 21.
  assert.equal(week.averageEurMinorByCategoryId.get(foodId), -10_000 / 3);
});
