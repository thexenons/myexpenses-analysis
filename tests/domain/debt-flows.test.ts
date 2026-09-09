import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateDebtBreakdown,
  aggregateFlowComposition,
  aggregateKpis,
  aggregateTimeSeries,
} from "../../src/domain/analytics/aggregations.ts";
import {
  applyFilters,
  createDefaultFilterState,
  restoreFilterState,
} from "../../src/domain/analytics/filters.ts";
import { resolvePostingAccounts } from "../../src/domain/analytics/transfer-relations.ts";
import type {
  AnalyticsDataset,
  NormalizedAccount,
  NormalizedPosting,
} from "../../src/domain/analytics/types.ts";

function account(id: string, type: "DEFAULT" | "DEBT"): NormalizedAccount {
  return {
    activePostingCount: 0,
    currency: "EUR",
    currentBalanceNativeMinor: 0,
    exchangeRateMode: "IDENTITY",
    fractionDigits: 2,
    historicalBalanceEurMinor: 0,
    id,
    label: id,
    openingBalanceEurMinor: 0,
    openingBalanceNativeMinor: 0,
    postingCount: 0,
    type,
    valuationBalanceEurMinor: 0,
  };
}

function posting(
  id: string,
  accountId: string,
  amount: number,
  overrides: Partial<NormalizedPosting> = {},
): NormalizedPosting {
  return {
    accountId,
    accountLabel: accountId,
    accountType: accountId === "cash" ? "DEFAULT" : "DEBT",
    amountEurMinor: amount,
    amountNativeMinor: amount,
    bucket: "expense",
    categoryPath: ["Supermercado"],
    categoryType: "EXPENSE",
    currency: "EUR",
    date: "2024-01-15",
    exchangeRateSource: "identity",
    exchangeRateToEur: 1,
    fractionDigits: 2,
    id,
    isVoid: false,
    linked: false,
    sourceTransactionId: id,
    splitCount: null,
    splitIndex: null,
    status: "CLEARED",
    tags: [],
    transactionId: id,
    ...overrides,
  };
}

function dataset(postings: readonly NormalizedPosting[]): AnalyticsDataset {
  return {
    accounts: [account("cash", "DEFAULT"), account("partner", "DEBT"), account("card", "DEBT")],
    currency: "EUR",
    maxDate: "2024-02-15",
    minDate: "2024-01-15",
    postings,
    source: {
      accounts: { version: 2, accounts: {} },
      categories: { Supermercado: { categoryType: "EXPENSE" } },
    },
  };
}

function sharedPurchase(): readonly NormalizedPosting[] {
  return [
    posting("own-split", "cash", -500, { splitIndex: 0, splitCount: 2 }),
    posting("partner-split", "cash", -500, {
      linked: true,
      splitIndex: 1,
      splitCount: 2,
      transferPeerPostingId: "partner-mirror",
    }),
    posting("partner-mirror", "partner", 500, {
      linked: true,
      transferPeerPostingId: "partner-split",
    }),
  ];
}

test("a categorized shared split records cash paid, own cost and financed share without a fictitious refund", () => {
  const filtered = applyFilters(dataset(sharedPurchase()), createDefaultFilterState());
  const kpis = aggregateKpis(filtered);
  const partner = aggregateDebtBreakdown(filtered).find((item) => item.account.id === "partner");
  assert.equal(kpis.realCashFlowEurMinor, -1_000);
  assert.equal(kpis.netExpensesEurMinor, -500);
  assert.equal(kpis.grossExpensesEurMinor, 1_000);
  assert.equal(kpis.expenseRefundsEurMinor, 0);
  assert.equal(kpis.debtExpenseAdjustmentsEurMinor, 500);
  assert.equal(partner?.advancesEurMinor, 500);
  assert.equal(partner?.recoveriesEurMinor, 0);
  assert.equal(partner?.grossDebtExpensesEurMinor, 500);
  assert.equal(partner?.debtExpenseRefundsEurMinor, 0);
  assert.equal(partner?.periodClosingBalanceEurMinor, 500);
});

test("debt-only and origin/destination filters retain the actual funding counterpart", () => {
  const filtered = applyFilters(dataset(sharedPurchase()), {
    ...createDefaultFilterState(),
    accountIds: ["partner"],
    scope: "debtsOnly",
    originAccountIds: ["cash"],
    destinationAccountIds: ["partner"],
    categoryPrefixes: [["Supermercado"]],
    dateRange: { from: "2024-01-01", to: "2024-01-31" },
  });
  const [partner] = aggregateDebtBreakdown(filtered);
  assert.equal(filtered.activePostings.length, 1);
  assert.equal(partner?.advancesEurMinor, 500);
  assert.equal(partner?.recoveriesEurMinor, 0);
  assert.equal(partner?.grossDebtExpensesEurMinor, 500);
});

test("an actual repayment is recovered cash and leaves the funded expense separate", () => {
  const repayments = [
    posting("repayment-debt", "partner", -300, {
      bucket: "transfer", categoryType: "TRANSFER", categoryPath: ["Transferencia"],
      date: "2024-02-15", linked: true, transferPeerPostingId: "repayment-cash",
    }),
    posting("repayment-cash", "cash", 300, {
      bucket: "transfer", categoryType: "TRANSFER", categoryPath: ["Transferencia"],
      date: "2024-02-15", linked: true, transferPeerPostingId: "repayment-debt",
    }),
  ];
  const filtered = applyFilters(dataset([...sharedPurchase(), ...repayments]), createDefaultFilterState());
  const partner = aggregateDebtBreakdown(filtered).find((item) => item.account.id === "partner");
  assert.equal(partner?.advancesEurMinor, 500);
  assert.equal(partner?.recoveriesEurMinor, 300);
  assert.equal(partner?.grossDebtExpensesEurMinor, 500);
  assert.equal(partner?.periodClosingBalanceEurMinor, 200);
  assert.equal(aggregateKpis(filtered).realCashFlowEurMinor, -700);
});

test("a categorized reversal is an actual refund only on the operational side", () => {
  const filtered = applyFilters(dataset([
    ...sharedPurchase(),
    posting("refund-cash", "cash", 200, { linked: true, transferPeerPostingId: "refund-partner" }),
    posting("refund-partner", "partner", -200, { linked: true, transferPeerPostingId: "refund-cash" }),
  ]), createDefaultFilterState());
  const composition = aggregateFlowComposition(filtered);
  const partner = aggregateDebtBreakdown(filtered).find((item) => item.account.id === "partner");
  assert.equal(composition.grossExpensesEurMinor, 1_000);
  assert.equal(composition.expenseRefundsEurMinor, 200);
  assert.equal(composition.debtExpenseAdjustmentsEurMinor, 300);
  assert.equal(composition.netExpensesEurMinor, -500);
  assert.equal(partner?.recoveriesEurMinor, 200);
  assert.equal(partner?.debtExpenseRefundsEurMinor, 200);
});

test("credit-card charges and adjustments are not guessed to be cash advances or repayments", () => {
  const filtered = applyFilters(dataset([
    posting("card-charge", "card", -1_000),
    posting("card-refund", "card", 100),
    posting("card-adjustment", "card", 200, {
      bucket: "transfer", categoryType: "NEUTRAL", categoryPath: ["Ajuste"],
    }),
    posting("orphan", "partner", 500, { linked: true, transferPeerPostingId: "missing" }),
  ]), createDefaultFilterState());
  const card = aggregateDebtBreakdown(filtered).find((item) => item.account.id === "card");
  assert.equal(card?.advancesEurMinor, 0);
  assert.equal(card?.recoveriesEurMinor, 0);
  assert.equal(card?.grossDebtExpensesEurMinor, 1_000);
  assert.equal(card?.debtExpenseRefundsEurMinor, 100);
  assert.equal(card?.periodClosingBalanceEurMinor, -700);
  const partner = aggregateDebtBreakdown(filtered).find((item) => item.account.id === "partner");
  assert.equal(partner?.recoveriesEurMinor, 0);
});

test("internal debt transfers and VOID counterparts are not cash movements", () => {
  const filtered = applyFilters(dataset([
    posting("debt-out", "partner", -200, {
      linked: true, bucket: "transfer", transferPeerPostingId: "debt-in",
    }),
    posting("debt-in", "card", 200, {
      linked: true, bucket: "transfer", transferPeerPostingId: "debt-out",
    }),
    posting("void-cash", "cash", -500, {
      isVoid: true, status: "VOID", linked: true, transferPeerPostingId: "void-peer",
    }),
    posting("void-peer", "partner", 500, { linked: true, transferPeerPostingId: "void-cash" }),
  ]), createDefaultFilterState());
  for (const debt of aggregateDebtBreakdown(filtered)) {
    assert.equal(debt.advancesEurMinor, 0);
    assert.equal(debt.recoveriesEurMinor, 0);
  }
});

test("moving categorized debt between people does not invent expenses or refunds", () => {
  const filtered = applyFilters(dataset([
    posting("debt-out", "partner", -200, { linked: true, transferPeerPostingId: "debt-in" }),
    posting("debt-in", "card", 200, { linked: true, transferPeerPostingId: "debt-out" }),
  ]), createDefaultFilterState());
  const composition = aggregateFlowComposition(filtered);
  assert.equal(composition.grossExpensesEurMinor, 0);
  assert.equal(composition.expenseRefundsEurMinor, 0);
  assert.equal(composition.netExpensesEurMinor, 0);
  for (const debt of aggregateDebtBreakdown(filtered)) {
    assert.equal(debt.grossDebtExpensesEurMinor, 0);
    assert.equal(debt.debtExpenseRefundsEurMinor, 0);
  }
});

test("funding in another currency uses the actual operational cash amount", () => {
  const filtered = applyFilters(dataset([
    posting("fx-cash", "cash", -480, { linked: true, transferPeerPostingId: "fx-partner" }),
    posting("fx-partner", "partner", 500, {
      currency: "USD", amountNativeMinor: 550, linked: true,
      transferPeerPostingId: "fx-cash", exchangeRateSource: "dynamic-rate",
    }),
  ]), { ...createDefaultFilterState(), scope: "debtsOnly" });
  const partner = aggregateDebtBreakdown(filtered).find((item) => item.account.id === "partner");
  assert.equal(partner?.advancesEurMinor, 480);
  assert.equal(partner?.grossDebtExpensesEurMinor, 480);
  assert.equal(partner?.netEurMinor, 500);

  const rounded = applyFilters(dataset([
    posting("tiny-cash", "cash", -1, { transferPeerPostingId: "tiny-partner" }),
    posting("tiny-partner", "partner", 0, {
      currency: "JPY", amountNativeMinor: 1, fractionDigits: 0,
      transferPeerPostingId: "tiny-cash", exchangeRateSource: "dynamic-rate",
    }),
  ]), { ...createDefaultFilterState(), scope: "debtsOnly" });
  const roundedDebt = aggregateDebtBreakdown(rounded).find((item) => item.account.id === "partner");
  assert.equal(roundedDebt?.advancesEurMinor, 1);
  assert.equal(roundedDebt?.grossDebtExpensesEurMinor, 1);
  assert.equal(roundedDebt?.netEurMinor, 0);
});

test("origin and destination match both linked sides independently of displayed account scope", () => {
  const source = dataset(sharedPurchase());
  const filters = { ...createDefaultFilterState(), originAccountIds: ["cash"], destinationAccountIds: ["partner"] };
  assert.deepEqual(applyFilters(source, filters).postings.map((item) => item.id), ["partner-split", "partner-mirror"]);
  assert.equal(aggregateKpis(applyFilters(source, { ...filters, scope: "realCashFlow" })).netEurMinor, -500);
  assert.equal(aggregateKpis(applyFilters(source, { ...filters, scope: "debtsOnly" })).netEurMinor, 500);
  assert.equal(applyFilters(source, { ...filters, originAccountIds: ["partner"], destinationAccountIds: ["cash"] }).postings.length, 0);
  assert.equal(applyFilters(source, { ...filters, destinationAccountIds: ["card"] }).postings.length, 0);
});

test("unlinked expenses have a known origin but no guessed destination", () => {
  const source = dataset([posting("unlinked", "cash", -500, { transferAccount: "partner" })]);
  assert.equal(applyFilters(source, { ...createDefaultFilterState(), originAccountIds: ["cash"] }).postings.length, 1);
  assert.equal(applyFilters(source, { ...createDefaultFilterState(), destinationAccountIds: ["partner"] }).postings.length, 0);
});

test("category matching can use a linked counterpart and exact paths without sibling leakage", () => {
  const source = dataset([
    posting("out", "cash", -500, { categoryPath: ["Gastos", "Casa"], linked: true, transferPeerPostingId: "in" }),
    posting("in", "partner", 500, { bucket: "transfer", categoryPath: ["Transferencia"], linked: true, transferPeerPostingId: "out" }),
    posting("nested", "cash", -100, { categoryPath: ["Gastos", "Casa", "Luz"] }),
  ]);
  const filters = { ...createDefaultFilterState(), categoryPrefixes: [["Gastos", "Casa"]] };
  assert.deepEqual(applyFilters(source, filters).postings.map((item) => item.id), ["out", "nested"]);
  assert.deepEqual(applyFilters(source, { ...filters, categoryDepth: "exact" }).postings.map((item) => item.id), ["out"]);
  assert.deepEqual(applyFilters(source, { ...filters, categoryDepth: "exact", categoryMatch: "either", scope: "debtsOnly" }).postings.map((item) => item.id), ["in"]);
  const debtOnly = applyFilters(source, { ...filters, categoryDepth: "exact", categoryMatch: "either", scope: "debtsOnly" });
  assert.equal(aggregateDebtBreakdown(debtOnly).find((item) => item.account.id === "partner")?.grossDebtExpensesEurMinor, 500);
});

test("content filters change activity, never the historical opening and closing balances", () => {
  const source = dataset([
    posting("opening", "cash", 10_000, { date: "2023-12-01", bucket: "income", categoryPath: ["Salario"] }),
    ...sharedPurchase(),
    posting("other", "cash", -2_000, { categoryPath: ["Luz"] }),
    posting("later", "cash", 8_000, { date: "2024-02-01", bucket: "income" }),
    posting("void", "cash", -99_000, { isVoid: true, status: "VOID" }),
  ]);
  const filters = { ...createDefaultFilterState(), scope: "realCashFlow" as const, categoryPrefixes: [["Supermercado"]], dateRange: { from: "2024-01-01" as const, to: "2024-01-31" as const } };
  const kpis = aggregateKpis(applyFilters(source, filters));
  assert.equal(kpis.netEurMinor, -1_000);
  assert.equal(kpis.periodOpeningBalanceEurMinor, 10_000);
  assert.equal(kpis.periodClosingBalanceEurMinor, 7_000);
  const empty = aggregateKpis(applyFilters(source, { ...filters, search: "never-matches" }));
  assert.equal(empty.netEurMinor, 0);
  assert.equal(empty.periodOpeningBalanceEurMinor, 10_000);
  assert.equal(empty.periodClosingBalanceEurMinor, 7_000);
});

test("value dates drive filtering, balances and period statistics with operation-date fallback", () => {
  const source = dataset([
    posting("delayed", "cash", -500, { date: "2024-01-31", valueDate: "2024-02-02" }),
    posting("fallback", "cash", -100, { date: "2024-02-03" }),
  ]);
  const filtered = applyFilters(source, { ...createDefaultFilterState(), dateBasis: "value", dateRange: { from: "2024-02-01", to: "2024-02-29" } });
  assert.deepEqual(filtered.postings.map((item) => item.id), ["delayed", "fallback"]);
  assert.equal(filtered.periodOpeningBalanceEurMinor, 0);
  assert.equal(filtered.periodClosingBalanceEurMinor, -600);
  assert.equal(aggregateTimeSeries(filtered, "month")[0]?.netEurMinor, -600);
  assert.equal(aggregateTimeSeries(filtered, "day").find((point) => point.key === "2024-02-02")?.netEurMinor, -500);
});

test("endpoint direction uses native sign even when EUR rounds to zero and requires reciprocal linkage", () => {
  const source = dataset([
    posting("tiny-out", "cash", 0, { amountNativeMinor: -1, transferPeerPostingId: "tiny-in" }),
    posting("tiny-in", "partner", 0, { amountNativeMinor: 1, transferPeerPostingId: "tiny-out" }),
    posting("broken", "cash", -100, { transferPeerPostingId: "tiny-in" }),
  ]);
  const out = source.postings[0]!;
  assert.equal(resolvePostingAccounts(out, source).destinationAccount?.id, "partner");
  assert.equal(resolvePostingAccounts(source.postings[2]!, source).peer, undefined);
  const inconsistent = dataset([
    posting("in-a", "cash", 100, { transferPeerPostingId: "in-b" }),
    posting("in-b", "partner", 100, { transferPeerPostingId: "in-a" }),
  ]);
  assert.equal(resolvePostingAccounts(inconsistent.postings[0]!, inconsistent).originAccount, undefined);
  assert.equal(resolvePostingAccounts(inconsistent.postings[0]!, inconsistent).peer?.id, "in-b");
});

test("new selectors restore independently and reject invalid direct values", () => {
  const restored = restoreFilterState({ originAccountIds: ["cash", "cash", 42], destinationAccountIds: ["partner"], dateBasis: "value", categoryMatch: "either", categoryDepth: "exact" });
  assert.deepEqual(restored.originAccountIds, ["cash"]);
  assert.deepEqual(restored.destinationAccountIds, ["partner"]);
  assert.equal(restored.dateBasis, "value");
  assert.equal(restored.categoryDepth, "exact");
  assert.equal(restoreFilterState({ dateBasis: "bad", categoryMatch: "bad", categoryDepth: "bad" }).dateBasis, "operation");
  assert.throws(() => applyFilters(dataset([]), { ...createDefaultFilterState(), dateBasis: "bad" as "value" }), /date basis/);
});

test("income-side debt mirrors are allocations, not fictitious income reversals", () => {
  const source = dataset([
    posting("income", "cash", 1_000, { bucket: "income", categoryType: "INCOME", categoryPath: ["Ingreso"], transferPeerPostingId: "income-peer" }),
    posting("income-peer", "partner", -1_000, { bucket: "income", categoryType: "INCOME", categoryPath: ["Ingreso"], transferPeerPostingId: "income" }),
  ]);
  const composition = aggregateFlowComposition(applyFilters(source, createDefaultFilterState()));
  assert.equal(composition.grossIncomeEurMinor, 1_000);
  assert.equal(composition.incomeReversalsEurMinor, 0);
  assert.equal(composition.debtIncomeAdjustmentsEurMinor, -1_000);
  assert.equal(composition.netIncomeEurMinor, 0);
});
