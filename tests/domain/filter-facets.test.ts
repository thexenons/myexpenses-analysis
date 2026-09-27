import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFilters,
  createDefaultFilterState,
  restoreFilterState,
  validateAmountRange,
} from "../../src/domain/analytics/filters.ts";
import {
  paymentMethodIdentityKey,
  payeeIdentityKey,
} from "../../src/domain/analytics/identity-keys.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import type { AnalyticsDataset, FilterState } from "../../src/domain/analytics/types.ts";

const normalized = normalizeDataset({
  accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
  categories: {
    Food: { categoryType: "EXPENSE" },
    Salary: { categoryType: "INCOME" },
    Move: { categoryType: "TRANSFER" },
    Adjust: { categoryType: "NEUTRAL" },
  },
  parsedData: [{
    uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0,
    transactions: [
      { uuid: "one", sourceTransactionUuid: "one", date: "2026-01-01", amount: -5, category: ["Food"], comment: "Café padre", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "two", sourceTransactionUuid: "two", date: "2026-01-02", amount: 0, category: ["Salary"], sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "three", sourceTransactionUuid: "three", date: "2026-01-03", amount: 5, category: ["Move"], sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "four", sourceTransactionUuid: "four", date: "2026-01-04", amount: -2, category: ["Adjust"], sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    ],
  }],
});

const dataset: AnalyticsDataset = {
  ...normalized,
  postings: normalized.postings.map((posting) => {
    if (posting.transactionId === "one") return Object.assign({}, posting, { payee: "Same", payeeSourceId: 1, paymentMethod: "Card", paymentMethodSourceId: 10, referenceNumber: "REF-1", splitIndex: 0, splitCount: 2, parent: { date: posting.date, amount: -5, comment: "Parent only" } });
    if (posting.transactionId === "two") return Object.assign({}, posting, { payee: "Same", payeeSourceId: 2, paymentMethod: "Card", paymentMethodSourceId: 11, currency: "GBP" as const, amountNativeMinor: 800, amountEurMinor: 0 });
    if (posting.transactionId === "three") return Object.assign({}, posting, { payee: "Same", paymentMethod: "Card", amountNativeMinor: 900, amountEurMinor: 500, referenceNumber: "REF-3" });
    return Object.assign({}, posting, { splitIndex: 1, splitCount: 2, parent: { date: posting.date, amount: -2, payee: "Parent only", paymentMethod: "Parent only", comment: "Parent comment" }, amountEurMinor: -200 });
  }),
};

const selected = (patch: Partial<FilterState>) => applyFilters(dataset, { ...createDefaultFilterState(), ...patch }).postings.map((posting) => posting.transactionId);

test("identity keys distinguish source ids, labels and missing values without collisions", () => {
  const keys = [payeeIdentityKey(dataset.postings[0]!), payeeIdentityKey(dataset.postings[1]!), payeeIdentityKey(dataset.postings[2]!), payeeIdentityKey(dataset.postings[3]!)];
  assert.equal(new Set(keys).size, 4);
  assert.deepEqual(selected({ payeeKeys: [keys[0]!] }), ["one"]);
  assert.deepEqual(selected({ payeeKeys: [keys[0]!, keys[1]!] }), ["one", "two"]);
  assert.deepEqual(selected({ payeeKeys: [keys[3]!] }), ["four"]);
  assert.deepEqual(selected({ paymentMethodKeys: [paymentMethodIdentityKey(dataset.postings[0]!)] }), ["one"]);
  assert.deepEqual(selected({ paymentMethodKeys: [paymentMethodIdentityKey(dataset.postings[1]!)] }), ["two"]);
  assert.deepEqual(selected({ paymentMethodKeys: [paymentMethodIdentityKey(dataset.postings[2]!)] }), ["three"]);
  assert.deepEqual(selected({ paymentMethodKeys: [paymentMethodIdentityKey(dataset.postings[3]!)] }), ["four"]);
  assert.deepEqual(selected({ payeeKeys: [keys[0]!], paymentMethodKeys: [paymentMethodIdentityKey(dataset.postings[1]!)] }), []);
});

test("new dimensions compose with old filters, classify neutral, and use base EUR absolute cents", () => {
  assert.deepEqual(selected({ categoryTypes: ["NEUTRAL"] }), ["four"]);
  assert.deepEqual(selected({ currencies: ["GBP"] }), ["two"]);
  assert.deepEqual(selected({ minAmountEurMinor: 0, maxAmountEurMinor: 0 }), ["two"]);
  assert.deepEqual(selected({ minAmountEurMinor: 500, maxAmountEurMinor: 500, categoryTypes: ["EXPENSE", "TRANSFER"], statuses: ["CLEARED"] }), ["one", "three"]);
  assert.deepEqual(selected({ minAmountEurMinor: 501 }), []);
  assert.deepEqual(selected({ currencies: ["GBP"], categoryTypes: ["INCOME"], maxAmountEurMinor: 0, statuses: ["CLEARED"] }), ["two"]);
});

test("comment includes split parent, reference is posting only, and tokens normalize independently", () => {
  assert.deepEqual(selected({ commentSearch: "PARENT cafe" }), ["one"]);
  assert.deepEqual(selected({ commentSearch: "parent only" }), ["one"]);
  assert.deepEqual(selected({ commentSearch: "cafe" }), ["one"]);
  assert.deepEqual(selected({ referenceSearch: "ref 1" }), ["one"]);
  assert.deepEqual(selected({ referenceSearch: "ref-1" }), ["one"]);
  assert.deepEqual(selected({ referenceSearch: "parent" }), []);
});

test("optional snapshots restore independently and reject malformed present ranges", () => {
  assert.equal(selected({}).length, 4);
  assert.equal(restoreFilterState({ minAmountEurMinor: 0 }).minAmountEurMinor, 0);
  const key = payeeIdentityKey(dataset.postings[0]!);
  assert.deepEqual(restoreFilterState({ payeeKeys: [key, key] }).payeeKeys, [key]);
  assert.throws(() => restoreFilterState({ payeeKeys: ["x"] }), /identity/i);
  assert.throws(() => restoreFilterState({ categoryTypes: ["NEUTRAL", "bad"] }), /category type/i);
  assert.throws(() => restoreFilterState({ minAmountEurMinor: "0" }), /amount/i);
  assert.throws(() => restoreFilterState({ minAmountEurMinor: 10, maxAmountEurMinor: 9 }), /amount/i);
  assert.throws(() => restoreFilterState({ commentSearch: 42 }), /comment/i);
  assert.equal(validateAmountRange(0, 0), null);
  assert.equal(validateAmountRange(5, 4), "reversed");
  for (const patch of [{ minAmountEurMinor: -1 }, { minAmountEurMinor: 1.5 }, { maxAmountEurMinor: Number.MAX_SAFE_INTEGER + 1 }, { minAmountEurMinor: 10, maxAmountEurMinor: 9 }]) {
    assert.throws(() => selected(patch), /amount/i);
  }
  assert.throws(() => selected({ payeeKeys: ["bad-key"] }), /identity/i);
});
