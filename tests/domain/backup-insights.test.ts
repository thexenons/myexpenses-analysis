import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { aggregateBackupInsights } from "../../src/domain/analytics/backup-insights.ts";
import type { BackupDatasetV1 } from "../../src/domain/analytics/backup-dataset.types.ts";
import {
  applyFilters,
  createDefaultFilterState,
} from "../../src/domain/analytics/filters.ts";
import { normalizeBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import type {
  AnalyticsDataset,
  IsoDate,
  NormalizedAccount,
  NormalizedPosting,
} from "../../src/domain/analytics/types.ts";

function account(
  id: string,
  nativeType: "CASH" | "LIABILITY",
  visible: boolean,
): NormalizedAccount {
  return {
    activePostingCount: 0,
    currency: "EUR",
    currentBalanceNativeMinor: 0,
    exchangeRateMode: "IDENTITY",
    excludedFromTotals: false,
    fractionDigits: 2,
    historicalBalanceEurMinor: 0,
    id,
    includedInAll: true,
    label: id,
    nativeType,
    openingBalanceEurMinor: 0,
    openingBalanceNativeMinor: 0,
    postingCount: 0,
    supportsReconciliation: true,
    type: nativeType === "LIABILITY" ? "DEBT" : "DEFAULT",
    valuationBalanceEurMinor: 0,
    visible,
  };
}

function posting(
  id: string,
  date: IsoDate,
  amountEurMinor: number,
  overrides: Partial<NormalizedPosting> = {},
): NormalizedPosting {
  return {
    accountId: "cash",
    accountLabel: "cash",
    accountType: "DEFAULT",
    amountEurMinor,
    amountNativeMinor: amountEurMinor,
    bucket: amountEurMinor < 0 ? "expense" : "income",
    categoryPath: amountEurMinor < 0 ? ["Gastos"] : ["Ingresos"],
    categoryType: amountEurMinor < 0 ? "EXPENSE" : "INCOME",
    currency: "EUR",
    date,
    exchangeRateSource: "identity",
    exchangeRateToEur: 1,
    fractionDigits: 2,
    id,
    isVoid: false,
    linked: false,
    searchIndex: id,
    sourceTransactionId: id,
    splitCount: null,
    splitIndex: null,
    status: "UNRECONCILED",
    tags: [],
    transactionId: id,
    ...overrides,
  } as NormalizedPosting;
}

function fixtureDataset(): AnalyticsDataset {
  const accounts = [
    account("cash", "CASH", true),
    account("debt", "LIABILITY", false),
  ];
  const postings: readonly NormalizedPosting[] = [
    posting("expense", "2024-01-01", -100, {
      localTime: "09:30:00",
      payee: "Tienda",
      paymentMethod: "Tarjeta",
      valueDate: "2024-01-02",
    }),
    posting("income", "2024-01-02", 200, {
      localTime: "00:00:00",
      valueDate: "2024-01-02",
    }),
    posting("void", "2024-01-03", -999, {
      accountId: "debt",
      accountLabel: "debt",
      accountType: "DEBT",
      isVoid: true,
      linked: true,
      localTime: "18:15:00",
      payee: "Payee anulado",
      splitCount: 1,
      splitIndex: 0,
      status: "VOID",
      valueDate: "2024-01-01",
    }),
    posting("second-income", "2024-01-07", 50, {
      localTime: "23:45:00",
      payee: "Tienda",
    }),
  ];
  const backup = {
    source: {
      format: "myexpenses-backup",
      schemaVersion: 189,
      backupSha256: "a".repeat(64),
      databaseSha256: "b".repeat(64),
    },
    preferences: {
      homeCurrency: "EUR",
      timeZone: "Europe/Madrid",
      monthStart: 1,
      weekStart: 1,
      includeTransfers: false,
    },
    currencies: [],
    accounts: [],
    categories: [],
    payees: [
      { sourceId: 1, name: "Tienda", shortName: null, parentSourceId: null },
      {
        sourceId: 2,
        name: "Payee sin uso",
        shortName: null,
        parentSourceId: null,
      },
    ],
    paymentMethods: [
      {
        sourceId: 1,
        label: "Tarjeta",
        type: "EXPENSE",
        isNumbered: false,
        icon: null,
      },
      {
        sourceId: 2,
        label: "Efectivo",
        type: "NEUTRAL",
        isNumbered: false,
        icon: null,
      },
    ],
    tags: [],
    budgets: [],
  } satisfies AnalyticsDataset["backup"];

  return {
    accounts,
    backup,
    currency: "EUR",
    maxDate: "2024-01-07",
    minDate: "2024-01-01",
    postings,
    source: {
      accounts: {
        version: 2,
        accounts: {
          cash: { label: "cash", type: "DEFAULT" },
          debt: { label: "debt", type: "DEBT" },
        },
      },
      categories: {},
    },
  };
}

test("excludes VOID from payee money but retains it in timing and provenance", () => {
  const filtered = applyFilters(fixtureDataset(), createDefaultFilterState());
  const insights = aggregateBackupInsights(filtered, { topPayeeLimit: 3 });
  assert.ok(insights !== null);

  assert.deepEqual(insights.payees, {
    activePostingCount: 3,
    coverageRatio: 2 / 3,
    definedPayeeCount: 2,
    payeePostingCount: 2,
    topExpenses: [
      {
        expenseEurMinor: -100,
        incomeEurMinor: 50,
        name: "Tienda",
        netEurMinor: -50,
        postingCount: 2,
        sourceId: null,
      },
    ],
    topIncome: [
      {
        expenseEurMinor: -100,
        incomeEurMinor: 50,
        name: "Tienda",
        netEurMinor: -50,
        postingCount: 2,
        sourceId: null,
      },
    ],
    topNet: [
      {
        expenseEurMinor: -100,
        incomeEurMinor: 50,
        name: "Tienda",
        netEurMinor: -50,
        postingCount: 2,
        sourceId: null,
      },
    ],
    usedPayeeCount: 1,
  });
  assert.equal(insights.provenance.voidPostingCount, 1);
  assert.equal(insights.provenance.linkedPostingCount, 1);
  assert.equal(insights.provenance.splitPartCount, 1);
  assert.equal(insights.timing.timedPostingCount, 3);
  assert.equal(insights.timing.midnightOrMissingTimeCount, 1);
});

test("groups local hours, ISO weekdays and effective value-date lag", () => {
  const insights = aggregateBackupInsights(
    applyFilters(fixtureDataset(), createDefaultFilterState()),
  );
  assert.ok(insights !== null);

  assert.equal(insights.timing.hours[9]?.postingCount, 1);
  assert.equal(insights.timing.hours[18]?.postingCount, 1);
  assert.equal(insights.timing.hours[23]?.postingCount, 1);
  assert.equal(insights.timing.hours[0]?.postingCount, 0);
  assert.deepEqual(
    insights.timing.weekdays.map((weekday) => [
      weekday.label,
      weekday.postingCount,
    ]),
    [
      ["Lunes", 1],
      ["Martes", 1],
      ["Miércoles", 1],
      ["Jueves", 0],
      ["Viernes", 0],
      ["Sábado", 0],
      ["Domingo", 1],
    ],
  );
  assert.deepEqual(insights.valueDates.lagDistribution, [
    { lagDays: -2, postingCount: 1 },
    { lagDays: 0, postingCount: 1 },
    { lagDays: 1, postingCount: 1 },
  ]);
  assert.equal(insights.valueDates.valueDatePostingCount, 3);
  assert.equal(insights.valueDates.distinctValueDateCount, 2);
  assert.equal(insights.valueDates.distinctValueDateFrom, "2024-01-01");
  assert.equal(insights.valueDates.distinctValueDateTo, "2024-01-02");
});

test("uses exactly the postings and accounts selected by global filters", () => {
  const defaults = createDefaultFilterState();
  const filtered = applyFilters(fixtureDataset(), {
    ...defaults,
    dateRange: { from: "2024-01-02", to: "2024-01-03" },
  });
  const insights = aggregateBackupInsights(filtered);
  assert.ok(insights !== null);
  assert.equal(insights.provenance.filteredPostingCount, 2);
  assert.equal(insights.provenance.activePostingCount, 1);
  assert.equal(insights.payees.payeePostingCount, 0);
  assert.equal(insights.timing.timedPostingCount, 1);

  const debtOnly = aggregateBackupInsights(
    applyFilters(fixtureDataset(), { ...defaults, scope: "debtsOnly" }),
  );
  assert.ok(debtOnly !== null);
  assert.equal(debtOnly.accounts.accountCount, 1);
  assert.equal(debtOnly.accounts.nativeTypes[4]?.accountCount, 1);
  assert.equal(debtOnly.accounts.hiddenCount, 1);
});

test("matches the enriched-data coverage of the reference backup", async (context) => {
  let source: string;
  try {
    source = await readFile(
      new URL("../../data/app-dataset.json", import.meta.url),
      "utf8",
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      context.skip("Import a local backup to run the private-data golden test");
      return;
    }
    throw error;
  }
  const raw = JSON.parse(source) as BackupDatasetV1;
  if (
    raw.source.backupSha256 !==
    "ec6e298ea1075e089770ac678603500f5f71f8e5f894b190fda1e5f06e435ab4"
  ) {
    context.skip("The local dataset is not the documented reference backup");
    return;
  }
  const dataset = normalizeBackupDataset(raw);
  const insights = aggregateBackupInsights(
    applyFilters(dataset, createDefaultFilterState()),
  );
  assert.ok(insights !== null);

  assert.equal(insights.payees.usedPayeeCount, 625);
  assert.equal(insights.payees.payeePostingCount, 7_834);
  assert.equal(insights.payees.activePostingCount, 13_018);
  assert.equal(Math.round(insights.payees.coverageRatio * 1_000), 602);
  assert.equal(insights.timing.timedPostingCount, 12_699);
  assert.equal(insights.valueDates.valueDatePostingCount, 10_160);
  assert.equal(insights.valueDates.distinctValueDateCount, 38);
  assert.equal(insights.valueDates.distinctValueDateFrom, "2024-02-22");
  assert.equal(insights.valueDates.distinctValueDateTo, "2025-10-21");
  assert.equal(insights.paymentMethods.definedMethodCount, 2);
  assert.equal(insights.paymentMethods.usedPostingCount, 1);
  assert.equal(insights.accounts.accountCount, 39);
  assert.equal(insights.accounts.hiddenCount, 24);
  assert.equal(insights.accounts.excludedFromTotalsCount, 0);
  assert.equal(insights.provenance.voidPostingCount, 4);
  assert.equal(insights.provenance.linkedPostingCount, 9_384);
  assert.equal(insights.provenance.splitPartCount, 7_185);
});
