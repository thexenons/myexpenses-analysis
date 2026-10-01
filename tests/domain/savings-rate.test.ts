import assert from "node:assert/strict";
import test from "node:test";

import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import { analyzeMonthlySavingsRate } from "../../src/domain/analytics/savings-rate.ts";
import type { AnalyticsDataset, FilterState, IsoDate } from "../../src/domain/analytics/types.ts";

function transaction(id: string, date: IsoDate, amount: number, category: readonly string[]) {
  return { uuid: id, date, amount, category: [...category], sourceTransactionUuid: id,
    sourceStatus: "RECONCILED" as const, splitIndex: null, splitCount: null };
}

function fixture(): AnalyticsDataset {
  return normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Bank", type: "DEFAULT" } } },
    categories: {
      Income: { categoryType: "INCOME" }, Expense: { categoryType: "EXPENSE" },
      Transfer: { categoryType: "TRANSFER" },
    },
    parsedData: [{ uuid: "cash", label: "Bank", currency: "EUR", openingBalance: 0, transactions: [
      transaction("jan-edge", "2024-01-15", -1, ["Expense"]),
      transaction("feb-income", "2024-02-02", 100, ["Income"]),
      transaction("feb-expense", "2024-02-05", -25, ["Expense"]),
      transaction("feb-refund", "2024-02-07", 5, ["Expense"]),
      transaction("feb-transfer", "2024-02-10", -10, ["Transfer"]),
      transaction("mar-edge", "2024-03-10", 50, ["Income"]),
    ] }],
  });
}

function analyze(source: AnalyticsDataset, filters: Partial<FilterState> = {}, today: IsoDate = "2024-04-01") {
  return analyzeMonthlySavingsRate(applyFilters(source, { ...createDefaultFilterState(), ...filters }), today);
}

test("only full observed calendar months appear, preserving refunds and excluding transfers", () => {
  const result = analyze(fixture());
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.deepEqual(result.months, [{
    key: "2024-02", startDate: "2024-02-01", endDate: "2024-02-29",
    incomeEurMinor: 10_000, expensesEurMinor: -2_000,
    resultEurMinor: 8_000, ratePercent: 80,
  }]);
});

test("the trend uses calendar months even when the imported accounting month starts mid-month", () => {
  const source = fixture();
  const accountingMonthSource: AnalyticsDataset = {
    ...source,
    backup: { preferences: { homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 15, weekStart: 1, includeTransfers: true } } as AnalyticsDataset["backup"],
  };
  const result = analyze(accountingMonthSource);
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.deepEqual(result.months.map(({ key, startDate, endDate }) => [key, startDate, endDate]), [
    ["2024-02", "2024-02-01", "2024-02-29"],
  ]);
});

test("date cuts, current month and observed edges never establish a full month", () => {
  const source = fixture();
  assert.equal(analyze(source, { dateRange: { from: "2024-02-02", to: "2024-03-31" } }).status, "unavailable");
  assert.equal(analyze(source, { dateRange: { from: "2024-01-01", to: "2024-02-28" } }).status, "unavailable");
  assert.equal(analyze(source, {}, "2024-02-29").status, "unavailable");
  assert.equal(analyze(source, { dateRange: { from: "2025-01-01", to: "2025-12-31" } }).status, "unavailable");
  const exact = analyze(source, { dateRange: { from: "2024-02-01", to: "2024-02-29" } });
  assert.equal(exact.status, "available");
});

test("empty full months and nonpositive net income have no rate, never zero or Infinity", () => {
  const source = fixture();
  const extended = { ...source, postings: source.postings.map((posting) => posting.transactionId === "feb-income"
    ? Object.assign({}, posting, { amountEurMinor: 0 }) : posting) };
  const result = analyze(extended);
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.months[0]?.ratePercent, null);
  const negativeIncome = { ...source, postings: source.postings.map((posting) => posting.transactionId === "feb-income"
    ? Object.assign({}, posting, { amountEurMinor: -10_000 }) : posting) };
  const negative = analyze(negativeIncome);
  assert.equal(negative.status, "available");
  if (negative.status === "available") assert.equal(negative.months[0]?.ratePercent, null);
});

test("refund-dominant and expense-dominant months preserve rates above 100% and below zero", () => {
  const source = fixture();
  const dominantRefund = { ...source, postings: source.postings.map((posting) => posting.transactionId === "feb-refund"
    ? Object.assign({}, posting, { amountEurMinor: 5_000 }) : posting) };
  const high = analyze(dominantRefund);
  assert.equal(high.status, "available");
  if (high.status === "available") assert.equal(high.months[0]?.ratePercent, 125);
  const dominantExpense = { ...source, postings: source.postings.map((posting) => posting.transactionId === "feb-expense"
    ? Object.assign({}, posting, { amountEurMinor: -15_000 }) : posting) };
  const low = analyze(dominantExpense);
  assert.equal(low.status, "available");
  if (low.status === "available") assert.equal(low.months[0]?.ratePercent, -45);
});

test("value-date bounds use operation-date fallback without claiming a partial month", () => {
  const source = fixture();
  const moved = { ...source, postings: source.postings.map((posting) => posting.transactionId === "jan-edge"
    ? Object.assign({}, posting, { valueDate: "2024-02-15" as const }) : posting) };
  assert.equal(analyze(moved).status, "available");
  assert.equal(analyze(moved, { dateBasis: "value" }).status, "unavailable");
});

test("fully bounded no-activity gaps remain months with unavailable denominators", () => {
  const source = fixture();
  const edges = { ...source, postings: source.postings.filter((posting) => posting.transactionId === "jan-edge" || posting.transactionId === "mar-edge")
    .map((posting) => posting.transactionId === "mar-edge" ? Object.assign({}, posting, { date: "2024-04-10" as const }) : posting) };
  const result = analyze(edges, {}, "2024-05-01");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.deepEqual(result.months.map((month) => [month.key, month.incomeEurMinor, month.resultEurMinor, month.ratePercent]), [
    ["2024-02", 0, 0, null], ["2024-03", 0, 0, null],
  ]);
});

test("non-date subsets suppress the trend, including active zero amount bounds", () => {
  const source = fixture();
  const subsets: Partial<FilterState>[] = [
    { accountIds: ["cash"] },
    { originAccountIds: ["cash"] }, { destinationAccountIds: ["cash"] },
    { categoryPrefixes: [["Expense"]] }, { statuses: ["RECONCILED"] },
    { tags: ["tag"] }, { search: "expense" }, { linked: "linked" },
    { payeeKeys: ['["missing"]'] }, { paymentMethodKeys: ['["missing"]'] },
    { categoryTypes: ["EXPENSE"] }, { currencies: ["EUR"] },
    { minAmountEurMinor: 0 }, { maxAmountEurMinor: 0 },
    { commentSearch: "comment" }, { referenceSearch: "reference" },
  ];
  for (const subset of subsets) {
    const result = analyze(source, subset);
    assert.deepEqual(result, { status: "unavailable", reason: "subset" }, JSON.stringify(subset));
  }
});

test("Real retention uses recorded cash variation and positive operational entries, while Yo retains accounting result", () => {
  const base = fixture();
  const source: AnalyticsDataset = {
    ...base,
    accounts: [...base.accounts, { ...base.accounts[0]!, id: "partner", label: "Partner allocation", type: "DEBT" }],
    postings: [...base.postings,
      { ...base.postings[0]!, id: "partner-expense", transactionId: "partner-expense", date: "2024-02-15", amountNativeMinor: -2_000, amountEurMinor: -2_000 },
      { ...base.postings[0]!, id: "partner-mirror", transactionId: "partner-mirror", accountId: "partner", accountType: "DEBT", date: "2024-02-15", amountNativeMinor: 2_000, amountEurMinor: 2_000 },
    ],
  };
  const real = analyze(source, { scope: "realCashFlow" });
  const all = analyze(source);
  assert.equal(real.status, "available");
  assert.equal(all.status, "available");
  if (real.status !== "available" || all.status !== "available") return;
  assert.equal(real.months[0]?.resultEurMinor, 5_000);
  assert.equal(real.months[0]?.cashEntriesEurMinor, 10_500);
  assert.equal(real.months[0]?.ratePercent, 5_000 / 10_500 * 100);
  assert.equal(all.months[0]?.resultEurMinor, 8_000);
  assert.equal(all.months[0]?.ratePercent, 80);
});

test("Debt trend is signed ledger variation, not a percentage or presumed repayment", () => {
  const base = fixture();
  const source: AnalyticsDataset = {
    ...base,
    accounts: [{ ...base.accounts[0]!, id: "partner", type: "DEBT" }],
    postings: base.postings.map((row) => Object.assign({}, row, { accountId: "partner", accountType: "DEBT" })),
  };
  const result = analyze(source, { scope: "debtsOnly" });
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.months[0]?.resultEurMinor, 7_000);
  assert.equal(result.months[0]?.ratePercent, null);
});

test("only reciprocal non-VOID DEFAULT transfers are excluded from the Real entry base", () => {
  const base = fixture();
  const row = base.postings.find((posting) => posting.transactionId === "feb-transfer")!;
  const entry = (id: string, amount: number, accountId = "cash", extra = {}) => ({
    ...row, id, transactionId: id, accountId, accountLabel: accountId,
    amountNativeMinor: amount, amountEurMinor: amount, ...extra,
  });
  const source: AnalyticsDataset = {
    ...base,
    accounts: [...base.accounts, { ...base.accounts[0]!, id: "savings", label: "Savings" }],
    postings: [...base.postings,
      entry("internal-in", 5_000, "cash", { transferPeerPostingId: "internal-out" }),
      entry("internal-out", -5_000, "savings", { transferPeerPostingId: "internal-in" }),
      entry("unlinked-in", 1_000),
      entry("broken-in", 1_000, "cash", { transferPeerPostingId: "broken-out" }),
      entry("broken-out", -1_000, "savings"),
      entry("void-peer-in", 500, "cash", { transferPeerPostingId: "void-peer-out" }),
      entry("void-peer-out", -500, "savings", { transferPeerPostingId: "void-peer-in", isVoid: true }),
    ],
  };
  const result = analyze(source, { scope: "realCashFlow" });
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.months[0]?.resultEurMinor, 8_500);
  assert.equal(result.months[0]?.cashEntriesEurMinor, 13_000);
  assert.equal(result.months[0]?.ratePercent, 8_500 / 13_000 * 100);
});

test("a cross-month internal transfer changes recorded cash variation but not the entry base", () => {
  const base = fixture();
  const row = base.postings.find((posting) => posting.transactionId === "feb-transfer")!;
  const source: AnalyticsDataset = {
    ...base,
    accounts: [...base.accounts, { ...base.accounts[0]!, id: "savings", label: "Savings" }],
    postings: [...base.postings,
      { ...row, id: "cross-in", transactionId: "cross-in", amountNativeMinor: 5_000, amountEurMinor: 5_000, transferPeerPostingId: "cross-out" },
      { ...row, id: "cross-out", transactionId: "cross-out", accountId: "savings", accountLabel: "Savings", date: "2024-03-05", amountNativeMinor: -5_000, amountEurMinor: -5_000, transferPeerPostingId: "cross-in" },
    ],
  };
  const result = analyze(source, { scope: "realCashFlow" });
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.months[0]?.resultEurMinor, 12_000);
  assert.equal(result.months[0]?.cashEntriesEurMinor, 10_500);
  assert.ok(result.months[0]!.ratePercent! > 100);
});

test("Real entries include refunds and recorded financing at converted EUR amounts, with signed unclamped rates", () => {
  const base = fixture();
  const row = base.postings.find((posting) => posting.transactionId === "feb-transfer")!;
  const financed: AnalyticsDataset = {
    ...base,
    postings: [...base.postings, {
      ...row, id: "loan-in", transactionId: "loan-in", currency: "USD", amountNativeMinor: 1_000,
      amountEurMinor: 750, exchangeRateToEur: 0.75, exchangeRateSource: "static", linked: false,
    }],
  };
  const result = analyze(financed, { scope: "realCashFlow" });
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.months[0]?.cashEntriesEurMinor, 11_250);
  assert.equal(result.months[0]?.resultEurMinor, 7_750);
  assert.equal(result.months[0]?.ratePercent, 7_750 / 11_250 * 100);

  const outflow = { ...base, postings: base.postings.map((posting) => posting.transactionId === "feb-income"
    ? Object.assign({}, posting, { amountNativeMinor: 0, amountEurMinor: 0 }) : posting) };
  const signed = analyze(outflow, { scope: "realCashFlow" });
  assert.equal(signed.status, "available");
  if (signed.status === "available") assert.equal(signed.months[0]?.ratePercent, -600);
  const noBase = { ...outflow, postings: outflow.postings.map((posting) => posting.transactionId === "feb-refund"
    ? Object.assign({}, posting, { amountNativeMinor: 0, amountEurMinor: 0 }) : posting) };
  const empty = analyze(noBase, { scope: "realCashFlow" });
  assert.equal(empty.status, "available");
  if (empty.status === "available") assert.equal(empty.months[0]?.ratePercent, null);
});
