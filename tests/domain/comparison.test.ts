import assert from "node:assert/strict";
import test from "node:test";

import { buildPeriodComparison, comparisonCurrentRange, type PeriodComparisonMetric } from "../../src/domain/analytics/comparison.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import type { FilterState, IsoDate, ParsedDirectTransaction } from "../../src/domain/analytics/types.ts";

function expense(id: string, date: IsoDate, amount: number, category = "Hogar"): ParsedDirectTransaction {
  return { uuid: id, sourceTransactionUuid: id, date, amount, category: [category], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null };
}

function fixture(overrides: Partial<FilterState> = {}) {
  const source = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Banco", type: "DEFAULT" } } },
    categories: { Hogar: { categoryType: "EXPENSE" }, Ocio: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "cash", label: "Banco", currency: "EUR", openingBalance: 0, transactions: [
      expense("old", "2024-02-02", -10),
      expense("previous", "2025-02-02", -20),
      expense("current", "2025-03-02", -30),
      expense("other", "2025-02-03", -500, "Ocio"),
    ] }],
  });
  return applyFilters(source, {
    ...createDefaultFilterState(),
    periodMode: "month",
    dateRange: { from: "2025-03-01", to: "2025-03-31" },
    categoryPrefixes: [["Hogar"]],
    ...overrides,
  });
}

test("compares calendar months retaining every non-date filter", () => {
  const result = buildPeriodComparison(fixture(), { mode: "previousPeriod" });
  assert.ok(result);
  assert.deepEqual(result.referenceRange, { from: "2025-02-01", to: "2025-02-28" });
  const expenses = result.metrics.find((metric) => metric.key === "expenses");
  assert.deepEqual(expenses, { key: "expenses", label: "Gasto neto seleccionado", currentEurMinor: 3000, referenceEurMinor: 2000, deltaEurMinor: 1000, deltaPercent: 50 });
  assert.equal(result.referencePostingCount, 1);
  const cash = result.metrics.find((metric) => metric.key === "realCashFlow");
  assert.equal(cash?.deltaPercent, -50, "negative flows use the absolute reference denominator");
});

test("an ongoing month compares the same elapsed part of the previous calendar month", () => {
  const result = buildPeriodComparison(fixture({ dateRange: { from: "2025-03-01", to: "2025-03-09" } }), { mode: "previousPeriod" });
  assert.deepEqual(result?.referenceRange, { from: "2025-02-01", to: "2025-02-09" });
  const clamped = buildPeriodComparison(fixture({ dateRange: { from: "2025-03-01", to: "2025-03-30" } }), { mode: "previousPeriod" });
  assert.deepEqual(clamped?.referenceRange, { from: "2025-02-01", to: "2025-02-28" });
});

test("custom spans compare the same number of inclusive days and zero has no percentage", () => {
  const result = buildPeriodComparison(fixture({ periodMode: "custom", dateRange: { from: "2025-03-01", to: "2025-03-03" } }), { mode: "previousPeriod" });
  assert.ok(result);
  assert.deepEqual(result.referenceRange, { from: "2025-02-26", to: "2025-02-28" });
  assert.equal(result.metrics.find((metric) => metric.key === "expenses")?.deltaPercent, null);
  assert.equal(result.referencePostingCount, 0);
});

test("previous-year comparison clamps leap days without spilling into March", () => {
  const result = buildPeriodComparison(fixture({ dateRange: { from: "2024-02-01", to: "2024-02-29" } }), { mode: "previousYear" });
  assert.deepEqual(result?.referenceRange, { from: "2023-02-01", to: "2023-02-28" });
  assert.equal(result?.referenceOutsideHistory, true);
});

test("explicit reference dates are validated and no comparison does no work", () => {
  const filtered = fixture();
  assert.equal(buildPeriodComparison(filtered, { mode: "none" }), null);
  assert.equal(buildPeriodComparison(filtered, { mode: "custom" }), null);
  assert.throws(() => buildPeriodComparison(filtered, { mode: "custom", dateRange: { from: "2025-03-02", to: "2025-03-01" } }));
  const result = buildPeriodComparison(filtered, { mode: "custom", dateRange: { from: "2024-02-01", to: "2024-02-29" } });
  assert.equal(result?.metrics.find((metric) => metric.key === "expenses")?.referenceEurMinor, 1000);
});

test("unbounded dates use file coverage instead of shrinking to matching categories", () => {
  assert.deepEqual(comparisonCurrentRange(fixture({ dateRange: { from: null, to: null } })), { from: "2024-02-02", to: "2025-03-02" });
});

test("comparison retains value-date filtering and derives unbounded value-date coverage", () => {
  const initial = fixture();
  const source = { ...initial.source, postings: initial.source.postings.map((posting) => ({ ...posting, valueDate: posting.id.endsWith("current") ? "2025-04-02" as const : posting.date })) };
  const filtered = applyFilters(source, { ...initial.filters, dateBasis: "value", dateRange: { from: "2025-04-01", to: "2025-04-30" } });
  const result = buildPeriodComparison(filtered, { mode: "previousPeriod" });
  assert.equal(result?.metrics.find((metric) => metric.key === "expenses")?.currentEurMinor, 3000);
  assert.equal(result?.metrics.find((metric) => metric.key === "expenses")?.referenceEurMinor, 0);
  assert.deepEqual(comparisonCurrentRange(applyFilters(source, { ...filtered.filters, dateRange: { from: null, to: null } })), { from: "2024-02-02", to: "2025-04-02" });
});

test("compares sent money, attributed expenses and full closing balances for the selected debt account", () => {
  const initial = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Banco", type: "DEFAULT" }, debt: { label: "Pareja", type: "DEBT" } } },
    categories: { Hogar: { categoryType: "EXPENSE" } },
    parsedData: [
      { uuid: "cash", label: "Banco", currency: "EUR", openingBalance: 0, transactions: [expense("first", "2025-02-02", -3), expense("second", "2025-03-02", -5)] },
      { uuid: "debt", label: "Pareja", currency: "EUR", openingBalance: 0, transactions: [expense("first", "2025-02-02", 3), expense("second", "2025-03-02", 5)] },
    ],
  });
  const source = { ...initial, postings: initial.postings.map((row) => Object.assign({}, row, { linked: true, transferPeerPostingId: initial.postings.find((candidate) => candidate.transactionId === row.transactionId && candidate.accountId !== row.accountId)!.id })) };
  const filtered = applyFilters(source, { ...createDefaultFilterState(), scope: "debtsOnly", accountIds: ["debt"], periodMode: "month", dateRange: { from: "2025-03-01", to: "2025-03-31" } });
  const result = buildPeriodComparison(filtered, { mode: "previousPeriod" });
  assert.ok(result);
  for (const key of ["debtSent", "debtNetExpense"]) {
    const metric: PeriodComparisonMetric = result.metrics.find((row) => row.key === key)!;
    assert.equal(metric.currentEurMinor, 500);
    assert.equal(metric.referenceEurMinor, 300);
    assert.equal(metric.deltaEurMinor, 200);
  }
  assert.equal(result.metrics.find((row) => row.key === "debtClosing")?.currentEurMinor, 800);
  assert.equal(result.metrics.find((row) => row.key === "debtClosing")?.referenceEurMinor, 300);
  assert.equal(result.metrics.find((row) => row.key === "expenseRefunds")?.currentEurMinor, 0);
  assert.equal(result.metrics.find((row) => row.key === "debtExpenseAdjustments")?.currentEurMinor, 500);
});
