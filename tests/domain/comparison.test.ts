import assert from "node:assert/strict";
import test from "node:test";

import * as comparisonModule from "../../src/domain/analytics/comparison.ts";
import { buildPeriodComparison, comparisonCurrentRange, type PeriodComparisonMetric } from "../../src/domain/analytics/comparison.ts";
import { buildCumulativeComparison } from "../../src/domain/analytics/comparison-cumulative.ts";
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

test("calendar-month comparison ignores an accounting month start", () => {
  const filtered = fixture();
  const shifted = {
    ...filtered,
    source: {
      ...filtered.source,
      backup: { preferences: { monthStart: 15 } },
    },
  } as unknown as typeof filtered;
  const result = buildPeriodComparison(shifted, { mode: "previousPeriod" });
  assert.deepEqual(result?.referenceRange, { from: "2025-02-01", to: "2025-02-28" });
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
  const result = buildPeriodComparison(filtered, { mode: "previousPeriod", includeCategories: true });
  assert.ok(result);
  assert.equal(result.categoryContributions!.reduce((sum, row) => sum + row.deltaEurMinor, 0), result.metrics.find((row) => row.key === "expenses")!.deltaEurMinor);
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

test("cumulative comparison aligns calendar-day offsets, preserves unequal endpoints and exact selected amounts", () => {
  const filtered = fixture({ periodMode: "custom", dateRange: { from: "2025-03-01", to: "2025-03-03" } });
  const comparison = buildPeriodComparison(filtered, { mode: "custom", dateRange: { from: "2025-02-01", to: "2025-02-02" } });
  assert.ok(comparison);
  const curve = buildCumulativeComparison(filtered, comparison, "expenses");
  assert.ok(curve);
  assert.deepEqual(curve.current.map(({ day, date, eurMinor }) => [day, date, eurMinor]), [
    [1, "2025-03-01", 0], [2, "2025-03-02", 3000], [3, "2025-03-03", 3000],
  ]);
  assert.deepEqual(curve.reference.map(({ day, date, eurMinor }) => [day, date, eurMinor]), [
    [1, "2025-02-01", 0], [2, "2025-02-02", 2000],
  ]);
  assert.equal(curve.sampled, false);
});

test("cumulative comparison retains signed refunds, net transfers, VOID exclusion and every metric endpoint", () => {
  const initial = fixture();
  const source = { ...initial.source, postings: [
    ...initial.source.postings,
    { ...initial.source.postings[0]!, id: "refund", date: "2025-03-03" as IsoDate, amountEurMinor: 5000, isVoid: false },
    { ...initial.source.postings[0]!, id: "void", date: "2025-03-04" as IsoDate, amountEurMinor: -9000, isVoid: true },
    { ...initial.source.postings[0]!, id: "transfer", date: "2025-03-05" as IsoDate, amountEurMinor: -700, bucket: "transfer" as const, isVoid: false },
  ] };
  const filtered = applyFilters(source, { ...initial.filters, dateRange: { from: "2025-03-01", to: "2025-03-05" } });
  const comparison = buildPeriodComparison(filtered, { mode: "previousPeriod" });
  assert.ok(comparison);
  for (const key of ["expenses", "income", "net"] as const) {
    const curve = buildCumulativeComparison(filtered, comparison, key);
    const metric: PeriodComparisonMetric = comparison.metrics.find((row) => row.key === key)!;
    assert.equal(curve?.current.at(-1)?.eurMinor, metric.currentEurMinor, key);
    assert.equal(curve?.reference.at(-1)?.eurMinor, metric.referenceEurMinor, key);
  }
  assert.equal(buildCumulativeComparison(filtered, comparison, "expenses")?.current.at(-1)?.eurMinor, -2000);
});

test("cumulative comparison samples very long ranges without losing endpoints or recorded movements", () => {
  const filtered = fixture({ periodMode: "custom", dateRange: { from: "0001-01-01", to: "9999-12-31" } });
  const comparison = buildPeriodComparison(filtered, { mode: "custom", dateRange: { from: "2025-03-02", to: "2025-03-02" } });
  assert.ok(comparison);
  const curve = buildCumulativeComparison(filtered, comparison, "net");
  assert.ok(curve);
  assert.equal(curve.sampled, true);
  assert.ok(curve.current.length <= 120);
  assert.deepEqual([curve.current[0]?.date, curve.current.at(-1)?.date], ["0001-01-01", "9999-12-31"]);
  assert.equal(curve.current.at(-1)?.eurMinor, comparison.metrics.find((row) => row.key === "net")?.currentEurMinor);
  assert.deepEqual(curve.reference.map((row) => [row.day, row.date]), [[1, "2025-03-02"]]);
});

test("cumulative comparison preserves leap-day and single-day reference identities", () => {
  const filtered = fixture({ periodMode: "custom", dateRange: { from: "2024-02-01", to: "2024-02-29" } });
  const comparison = buildPeriodComparison(filtered, { mode: "previousYear" });
  assert.ok(comparison);
  const curve = buildCumulativeComparison(filtered, comparison, "expenses");
  assert.deepEqual([curve?.current.at(-1)?.day, curve?.current.at(-1)?.date], [29, "2024-02-29"]);
  assert.deepEqual([curve?.reference.at(-1)?.day, curve?.reference.at(-1)?.date], [28, "2023-02-28"]);
  const oneDay = buildPeriodComparison(filtered, { mode: "custom", dateRange: { from: "2024-02-02", to: "2024-02-02" } });
  assert.ok(oneDay);
  assert.deepEqual(buildCumulativeComparison(filtered, oneDay, "expenses")?.reference.map((point) => point.day), [1]);
});

test("cumulative endpoints equal comparison metrics across all account scopes and value-date subsets", () => {
  const normalized = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Banco", type: "DEFAULT" }, debt: { label: "Pareja", type: "DEBT" } } },
    categories: { Hogar: { categoryType: "EXPENSE" } },
    parsedData: [
      { uuid: "cash", label: "Banco", currency: "EUR", openingBalance: 0, transactions: [expense("old", "2025-02-02", -3), expense("now", "2025-03-02", -5)] },
      { uuid: "debt", label: "Pareja", currency: "EUR", openingBalance: 0, transactions: [expense("old", "2025-02-02", 3), expense("now", "2025-03-02", 5)] },
    ],
  });
  const source = { ...normalized, postings: normalized.postings.map((posting) => Object.assign({}, posting, {
    linked: true,
    transferPeerPostingId: normalized.postings.find((peer) => peer.transactionId === posting.transactionId && peer.accountId !== posting.accountId)!.id,
    valueDate: posting.transactionId === "now" ? "2025-03-04" as IsoDate : posting.valueDate,
  })) };
  for (const scope of ["all", "realCashFlow", "debtsOnly"] as const) {
    const filtered = applyFilters(source, {
      ...createDefaultFilterState(), scope, dateBasis: "value", periodMode: "custom",
      dateRange: { from: "2025-03-01", to: "2025-03-04" }, categoryPrefixes: [["Hogar"]],
    });
    const comparison = buildPeriodComparison(filtered, { mode: "custom", includeCategories: true, dateRange: { from: "2025-02-01", to: "2025-02-04" } });
    assert.ok(comparison);
    assert.equal(comparison.categoryContributions!.reduce((sum, row) => sum + row.deltaEurMinor, 0), comparison.metrics.find((row) => row.key === "expenses")!.deltaEurMinor, scope);
    for (const key of ["expenses", "income", "net"] as const) {
      const curve = buildCumulativeComparison(filtered, comparison, key);
      const metric: PeriodComparisonMetric = comparison.metrics.find((row) => row.key === key)!;
      assert.equal(curve?.current.at(-1)?.eurMinor, metric.currentEurMinor, `${scope} ${key} current`);
      assert.equal(curve?.reference.at(-1)?.eurMinor, metric.referenceEurMinor, `${scope} ${key} reference`);
      assert.equal(curve?.current[2]?.eurMinor, 0, "value-date activity remains flat before the posted value date");
    }
    assert.equal(buildCumulativeComparison(filtered, comparison, "expenses")?.current.at(-1)?.eurMinor,
      scope === "debtsOnly" ? -500 : scope === "realCashFlow" ? 500 : 0,
      "verified debt counterparties retain their signed selected-expense semantics");
  }
});

test("cumulative comparison uses already converted EUR postings under currency and status filters", () => {
  const source = normalizeDataset({
    accounts: { version: 2, accounts: { usd: { label: "Dólares", type: "DEFAULT", exchangeRateMode: "STATIC", exchangeRateToEur: 0.5 } } },
    categories: { Hogar: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "usd", label: "Dólares", currency: "USD", openingBalance: 0, transactions: [
      expense("old", "2025-02-02", -8), expense("now", "2025-03-02", -10),
      { ...expense("void", "2025-03-03", -100), sourceStatus: "VOID" },
    ] }],
  });
  const filtered = applyFilters(source, {
    ...createDefaultFilterState(), periodMode: "month", dateRange: { from: "2025-03-01", to: "2025-03-31" },
    currencies: ["USD"], statuses: ["RECONCILED"],
  });
  const comparison = buildPeriodComparison(filtered, { mode: "previousPeriod" });
  assert.ok(comparison);
  const curve = buildCumulativeComparison(filtered, comparison, "expenses");
  assert.equal(curve?.current.at(-1)?.eurMinor, 500);
  assert.equal(curve?.reference.at(-1)?.eurMinor, 400);
  assert.equal(curve?.current.at(-1)?.eurMinor, comparison.metrics.find((item) => item.key === "expenses")?.currentEurMinor);
});


test("root category contributions reconcile selected expense changes without counting descendants twice", () => {
  const initial = fixture({ categoryPrefixes: [] });
  const base = initial.source.postings[0]!;
  const source = { ...initial.source, postings: [
    ...initial.source.postings,
    { ...base, id: "child", date: "2025-03-03" as IsoDate, categoryPath: ["Hogar", "Child"], amountEurMinor: -500 },
    { ...base, id: "refund", date: "2025-03-04" as IsoDate, amountEurMinor: 500 },
    { ...base, id: "uncategorized", date: "2025-03-05" as IsoDate, categoryPath: [], amountEurMinor: -100 },
    { ...base, id: "equal", date: "2025-03-05" as IsoDate, categoryPath: ["Equal"], amountEurMinor: -100 },
    { ...base, id: "zero-cost", date: "2025-03-06" as IsoDate, categoryPath: ["Zero"], amountEurMinor: -200 },
    { ...base, id: "zero-refund", date: "2025-03-07" as IsoDate, categoryPath: ["Zero"], amountEurMinor: 200 },
    { ...base, id: "void", date: "2025-03-08" as IsoDate, categoryPath: ["VOID only"], amountEurMinor: -90_000, isVoid: true },
  ] };
  const filtered = applyFilters(source, initial.filters);
  const comparison = buildPeriodComparison(filtered, { mode: "previousPeriod", includeCategories: true })!;
  const rows = comparison.categoryContributions!;
  assert.ok(Array.isArray(rows));
  assert.equal(rows.reduce((sum, row) => sum + row.deltaEurMinor, 0), comparison.metrics.find((metric) => metric.key === "expenses")!.deltaEurMinor);
  assert.deepEqual(rows.map(({ id }) => id), ['["Ocio"]', '["Hogar"]', '["Equal"]', '[]', '["Zero"]']);
  assert.deepEqual(rows.find(({ id }) => id === '["Hogar"]'), { id: '["Hogar"]', name: "Hogar", path: ["Hogar"], currentEurMinor: 3000, referenceEurMinor: 2000, deltaEurMinor: 1000, currentPostingCount: 3, referencePostingCount: 1 });
  assert.equal(rows.find(({ id }) => id === '["Ocio"]')?.currentPostingCount, 0);
  assert.equal(rows.find(({ id }) => id === '["Zero"]')?.currentEurMinor, 0);
  assert.equal(rows.find(({ id }) => id === '["Zero"]')?.currentPostingCount, 2);
  const none = applyFilters(source, { ...filtered.filters, search: "no matching synthetic text" });
  assert.deepEqual(buildPeriodComparison(none, { mode: "previousPeriod", includeCategories: true })?.categoryContributions, []);
  assert.equal(buildPeriodComparison(filtered, { mode: "previousPeriod" })?.categoryContributions, undefined);
});

test("category evidence intersects include posting predicates and preserves every other filter", () => {
  assert.equal(typeof comparisonModule.categoryComparisonFilters, "function");
  const initial = fixture({ dateBasis: "value", accountIds: ["cash"], search: "Hogar", commentSearch: "", currencies: ["EUR"], maxAmountEurMinor: 10_000 });
  const range = { from: "2025-02-01", to: "2025-02-28" } as const;
  const base = initial.source.postings.find((row) => row.transactionId === "previous")!;
  const source = { ...initial.source, postings: [...initial.source.postings,
    { ...base, id: "child", categoryPath: ["Hogar", "Child"] },
    { ...base, id: "grandchild", categoryPath: ["Hogar", "Child", "Grandchild"] },
    { ...base, id: "outside-value-date", categoryPath: ["Hogar", "Child"], valueDate: "2025-03-02" as IsoDate },
  ] };
  for (const categoryDepth of ["exact", "subtree"] as const) {
    const filters = { ...initial.filters, categoryDepth, categoryPrefixes: [["Hogar", "Child"], ["Ocio"]] };
    const next = comparisonModule.categoryComparisonFilters(filters, ["Hogar"], range)!;
    assert.deepEqual(next, { ...filters, periodMode: "custom", dateRange: range, categoryPrefixes: [["Hogar", "Child"]], categoryDepth, categoryMode: "include", categoryMatch: "posting" });
    const expected = applyFilters(source, { ...filters, dateRange: range }).activePostings.filter((row) => row.categoryPath[0] === "Hogar");
    assert.deepEqual(expected.map(({ id }) => id), categoryDepth === "exact" ? ["child"] : ["child", "grandchild"]);
    assert.deepEqual(applyFilters(source, next).activePostings.map(({ id }) => id), expected.map(({ id }) => id));
  }
  const noCategory = { ...initial.filters, categoryPrefixes: [] };
  assert.deepEqual(comparisonModule.categoryComparisonFilters(noCategory, [], range)?.categoryPrefixes, [[]]);
  for (const selection of [{ categoryMode: "exclude" as const }, { categoryMatch: "either" as const }]) {
    assert.equal(comparisonModule.categoryComparisonFilters({ ...initial.filters, ...selection }, ["Hogar"], range), null);
  }
  assert.equal(comparisonModule.categoryComparisonFilters(initial.filters, ["Ocio"], range), null);
});
