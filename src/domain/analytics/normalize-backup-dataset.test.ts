import { describe, expect, it } from "vitest";

import type { BackupDatasetV1 } from "./backup-dataset.types.ts";
import { applyFilters, createDefaultFilterState } from "./filters.ts";
import {
  normalizeBackupDataset,
  parseBackupDataset,
} from "./normalize-backup-dataset.ts";
import { normalizeDataset } from "./normalize.ts";

function datasetFixture(): BackupDatasetV1 {
  return {
    version: 1,
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
      includeTransfers: true,
    },
    currencies: [
      {
        sourceId: 1,
        code: "EUR",
        fractionDigits: 2,
        label: "Euro",
        symbol: "€",
        commodityType: "FIAT",
      },
      {
        sourceId: 2,
        code: "GBP",
        fractionDigits: 2,
        label: "Pound sterling",
        symbol: "£",
        commodityType: "FIAT",
      },
    ],
    accounts: [
      {
        uuid: "gbp-account",
        sourceId: 7,
        label: "Ahorro GBP",
        description: null,
        currency: "GBP",
        fractionDigits: 2,
        nativeType: "BANK",
        scope: "DEFAULT",
        parentUuid: null,
        openingNativeMinor: 100,
        openingHomeMinor: 125,
        exchangeRateMode: "STATIC",
        exchangeRateToHome: 1.25,
        flags: {
          sourceId: 0,
          visible: true,
          excludedFromTotals: false,
          includedInAll: true,
          isAsset: true,
          supportsReconciliation: true,
        },
        balances: {
          currentNativeMinor: 201,
          historicalHomeMinor: 252,
          valuationHomeMinor: 253,
        },
      },
    ],
    categories: [
      {
        uuid: "category-income",
        sourceId: 9,
        name: "Ingresos",
        type: "INCOME",
        parentUuid: null,
        path: ["Ingresos"],
        color: null,
        icon: null,
      },
    ],
    postings: [
      {
        id: "gbp-account:posting-uuid",
        sourceId: 42,
        transactionUuid: "posting-uuid",
        sourceTransactionUuid: "posting-uuid",
        accountUuid: "gbp-account",
        epochSeconds: 1_704_153_600,
        localDate: "2024-01-02",
        localTime: "01:00:00",
        valueEpochSeconds: null,
        valueLocalDate: null,
        valueLocalTime: null,
        amountNativeMinor: 101,
        amountHomeMinor: 127,
        categoryUuid: "category-income",
        categoryPath: ["Ingresos"],
        categoryType: "INCOME",
        bucket: "income",
        status: "CLEARED",
        isVoid: false,
        isArchivedContent: false,
        payeeSourceId: 3,
        paymentMethodSourceId: 4,
        tagSourceIds: [5],
        comment: "Ingreso exacto",
        referenceNumber: null,
        originalAmountMinor: null,
        originalCurrency: null,
        split: null,
        fxSource: "DYNAMIC_EQUIVALENT",
        exchangeRateToHome: 1.25,
      },
    ],
    payees: [
      { sourceId: 3, name: "Empresa", shortName: null, parentSourceId: null },
    ],
    paymentMethods: [
      {
        sourceId: 4,
        label: "Transferencia bancaria",
        type: "NEUTRAL",
        isNumbered: false,
        icon: null,
      },
    ],
    tags: [{ sourceId: 5, name: "Nómina", color: null }],
    budgets: [],
  };
}

describe("backup dataset v1", () => {
  it("validates every nested collection and rejects unknown root fields", () => {
    expect(parseBackupDataset(datasetFixture())).toMatchObject({
      version: 1,
      source: { schemaVersion: 189 },
    });
    expect(() =>
      parseBackupDataset({ ...datasetFixture(), unexpected: true }),
    ).toThrow(/unexpected property "unexpected"/);
  });

  it("freezes validated graphs before reusing their WeakSet trust", () => {
    const parsed = parseBackupDataset(datasetFixture());

    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.postings)).toBe(true);
    expect(Object.isFrozen(parsed.postings[0])).toBe(true);
    expect(() => {
      (parsed.postings[0] as { amountHomeMinor: number }).amountHomeMinor = 999;
    }).toThrow(TypeError);
    expect(parseBackupDataset(parsed)).toBe(parsed);
    expect(normalizeBackupDataset(parsed).postings[0]?.amountEurMinor).toBe(127);
  });

  it("rejects unsafe minor-unit values before they enter analytics", () => {
    const value = structuredClone(datasetFixture()) as unknown as {
      postings: Array<{ amountHomeMinor: number }>;
    };
    value.postings[0]!.amountHomeMinor = Number.MAX_SAFE_INTEGER + 1;

    expect(() => parseBackupDataset(value)).toThrow(
      /amountHomeMinor: expected a safe integer/,
    );
  });

  it("requires EUR home metadata with exactly two fraction digits", () => {
    const fixture = datasetFixture();
    const invalid: BackupDatasetV1 = {
      ...fixture,
      currencies: fixture.currencies.with(0, {
        ...fixture.currencies[0]!,
        fractionDigits: 3,
      }),
    };

    expect(() => parseBackupDataset(invalid)).toThrow(
      /EUR home currency must define fractionDigits=2/u,
    );
  });

  it("validates original-currency references and preserves native precision", () => {
    const fixture = datasetFixture();
    const withPrecision: BackupDatasetV1 = {
      ...fixture,
      currencies: [
        ...fixture.currencies.with(1, {
          ...fixture.currencies[1]!,
          fractionDigits: 3,
        }),
        {
          sourceId: 3,
          code: "JPY",
          fractionDigits: 0,
          label: "Yen",
          symbol: "¥",
          commodityType: "FIAT",
        },
      ],
      accounts: fixture.accounts.with(0, {
        ...fixture.accounts[0]!,
        fractionDigits: 3,
      }),
      postings: fixture.postings.with(0, {
        ...fixture.postings[0]!,
        originalAmountMinor: 123,
        originalCurrency: "JPY",
      }),
    };
    const normalized = normalizeBackupDataset(withPrecision);

    expect(normalized.accounts[0]?.fractionDigits).toBe(3);
    expect(normalized.postings[0]).toMatchObject({
      fractionDigits: 3,
      originalCurrency: "JPY",
      originalFractionDigits: 0,
    });

    const unknownOriginal: BackupDatasetV1 = {
      ...fixture,
      postings: fixture.postings.with(0, {
        ...fixture.postings[0]!,
        originalAmountMinor: 123,
        originalCurrency: "USD",
      }),
    };
    expect(() => parseBackupDataset(unknownOriginal)).toThrow(
      /unknown originalCurrency/u,
    );
  });

  it("uses canonical home amounts and optional balances without recalculating FX", () => {
    const source = datasetFixture();
    const dataset = normalizeBackupDataset(source);
    const posting = dataset.postings[0];
    const account = dataset.accounts[0];

    expect(posting).toMatchObject({
      amountNativeMinor: 101,
      amountEurMinor: 127,
      backupStatus: "CLEARED",
      status: "CLEARED",
      payee: "Empresa",
      paymentMethod: "Transferencia bancaria",
      tags: ["Nómina"],
    });
    expect(posting).not.toHaveProperty("valueDate");
    expect(account).toMatchObject({
      currentBalanceNativeMinor: 201,
      historicalBalanceEurMinor: 252,
      valuationBalanceEurMinor: 253,
      sourceRowId: 7,
      nativeType: "BANK",
      visible: true,
    });
    expect(dataset.backup?.accounts).toBe(source.accounts);
    expect(dataset.backup?.budgets).toBe(source.budgets);
    expect(
      applyFilters(dataset, {
        ...createDefaultFilterState(),
        statuses: ["CLEARED"],
      }).postings,
    ).toHaveLength(1);
  });

  it("derives backup search indexes lazily without losing payee aliases", () => {
    const fixture = datasetFixture();
    const aliased: BackupDatasetV1 = {
      ...fixture,
      payees: fixture.payees.with(0, {
        ...fixture.payees[0]!,
        name: "Sociedad Matriz",
        shortName: "EMC",
      }),
    };
    const dataset = normalizeBackupDataset(aliased);
    const defaults = createDefaultFilterState();

    expect(dataset.postings[0]?.searchIndex).toBeUndefined();
    expect(
      applyFilters(dataset, { ...defaults, search: "EMC" }).postings,
    ).toHaveLength(1);
    expect(
      applyFilters(dataset, { ...defaults, search: "Sociedad Matriz" }).postings,
    ).toHaveLength(1);
  });

  it("routes v1 data through normalizeDataset while keeping legacy inputs supported", () => {
    expect(normalizeDataset(datasetFixture()).postings).toHaveLength(1);
    const legacy = normalizeDataset({
      accounts: {
        version: 2,
        accounts: { legacy: { label: "Legacy", type: "DEFAULT" } },
      },
      categories: { Neutral: { categoryType: "NEUTRAL" } },
      parsedData: [
        {
          uuid: "legacy",
          label: "Legacy",
          currency: "EUR",
          openingBalance: 0,
          transactions: [
            {
              uuid: "zero",
              date: "2024-01-01",
              amount: 0,
              category: ["Neutral"],
              sourceTransactionUuid: "zero",
              sourceStatus: "UNRECONCILED",
              splitIndex: null,
              splitCount: null,
            },
          ],
        },
      ],
    });
    expect(legacy.postings[0]?.bucket).toBe("expense");
  });

  it("accepts a zero posting without inventing a source exchange rate", () => {
    const base = datasetFixture();
    const fixture: BackupDatasetV1 = {
      ...base,
      accounts: [
        {
          ...base.accounts[0]!,
          balances: {
            currentNativeMinor: 100,
            historicalHomeMinor: 125,
            valuationHomeMinor: 125,
          },
        },
      ],
      postings: [
        {
          ...base.postings[0]!,
          amountNativeMinor: 0,
          amountHomeMinor: 0,
          categoryType: "NEUTRAL",
          bucket: "expense",
          fxSource: "ZERO_AMOUNT_WITHOUT_RATE",
          exchangeRateToHome: null,
        },
      ],
      categories: [
        {
          ...base.categories[0]!,
          type: "NEUTRAL",
        },
      ],
    };

    const normalized = normalizeBackupDataset(fixture).postings[0];
    expect(normalized).toMatchObject({
      amountEurMinor: 0,
      backupFxSource: "ZERO_AMOUNT_WITHOUT_RATE",
    });
  });
});
