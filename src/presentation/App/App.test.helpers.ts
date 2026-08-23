import { vi } from "vitest";

import type { BackupDatasetV1 } from "../../domain/analytics/backup-dataset.types.ts";
import { encryptCompressedDataset } from "../../domain/security/static-vault.ts";
import type { StaticVaultEnvelopeV1 } from "../../domain/security/static-vault.types.ts";

export const APP_TEST_PASSPHRASE = "correct horse battery staple";

const APP_DATASET: BackupDatasetV1 = {
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
    includeTransfers: false,
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
  ],
  accounts: [
    {
      uuid: "cash",
      sourceId: 1,
      label: "Cuenta principal",
      description: null,
      currency: "EUR",
      fractionDigits: 2,
      nativeType: "CASH",
      scope: "DEFAULT",
      parentUuid: null,
      openingNativeMinor: 10_000,
      openingHomeMinor: 10_000,
      exchangeRateMode: "IDENTITY",
      exchangeRateToHome: 1,
      flags: {
        sourceId: 1,
        visible: true,
        excludedFromTotals: false,
        includedInAll: true,
        isAsset: true,
        supportsReconciliation: false,
      },
      balances: {
        currentNativeMinor: 13_000,
        historicalHomeMinor: 13_000,
        valuationHomeMinor: 13_000,
      },
    },
    {
      uuid: "debt",
      sourceId: 2,
      label: "Persona",
      description: null,
      currency: "EUR",
      fractionDigits: 2,
      nativeType: "LIABILITY",
      scope: "DEBT",
      parentUuid: null,
      openingNativeMinor: 0,
      openingHomeMinor: 0,
      exchangeRateMode: "IDENTITY",
      exchangeRateToHome: 1,
      flags: {
        sourceId: 1,
        visible: true,
        excludedFromTotals: false,
        includedInAll: true,
        isAsset: false,
        supportsReconciliation: true,
      },
      balances: {
        currentNativeMinor: 2_000,
        historicalHomeMinor: 2_000,
        valuationHomeMinor: 2_000,
      },
    },
  ],
  categories: [
    {
      uuid: "category-expense",
      sourceId: 1,
      name: "Gastos",
      type: "EXPENSE",
      parentUuid: null,
      path: ["Gastos"],
      color: null,
      icon: null,
    },
    {
      uuid: "category-income",
      sourceId: 2,
      name: "Ingresos",
      type: "INCOME",
      parentUuid: null,
      path: ["Ingresos"],
      color: null,
      icon: null,
    },
    {
      uuid: "category-transfer",
      sourceId: 3,
      name: "Transferencia",
      type: "TRANSFER",
      parentUuid: null,
      path: ["Transferencia"],
      color: null,
      icon: null,
    },
  ],
  postings: [
    {
      id: "cash:income",
      sourceId: 1,
      transactionUuid: "income",
      sourceTransactionUuid: "income",
      accountUuid: "cash",
      epochSeconds: 1_767_225_600,
      localDate: "2026-01-01",
      localTime: "01:00:00",
      valueEpochSeconds: null,
      valueLocalDate: null,
      valueLocalTime: null,
      amountNativeMinor: 5_000,
      amountHomeMinor: 5_000,
      categoryUuid: "category-income",
      categoryPath: ["Ingresos"],
      categoryType: "INCOME",
      bucket: "income",
      status: "RECONCILED",
      isVoid: false,
      isArchivedContent: false,
      payeeSourceId: 1,
      paymentMethodSourceId: null,
      tagSourceIds: [],
      comment: null,
      referenceNumber: null,
      originalAmountMinor: null,
      originalCurrency: null,
      split: null,
      fxSource: "HOME_CURRENCY",
      exchangeRateToHome: 1,
    },
    {
      id: "cash:expense",
      sourceId: 2,
      transactionUuid: "expense",
      sourceTransactionUuid: "expense",
      accountUuid: "cash",
      epochSeconds: 1_767_312_000,
      localDate: "2026-01-02",
      localTime: "01:00:00",
      valueEpochSeconds: null,
      valueLocalDate: null,
      valueLocalTime: null,
      amountNativeMinor: -2_000,
      amountHomeMinor: -2_000,
      categoryUuid: "category-expense",
      categoryPath: ["Gastos"],
      categoryType: "EXPENSE",
      bucket: "expense",
      status: "UNRECONCILED",
      isVoid: false,
      isArchivedContent: false,
      payeeSourceId: 2,
      paymentMethodSourceId: null,
      tagSourceIds: [],
      comment: null,
      referenceNumber: null,
      originalAmountMinor: null,
      originalCurrency: null,
      split: null,
      fxSource: "HOME_CURRENCY",
      exchangeRateToHome: 1,
    },
    {
      id: "debt:debt-movement",
      sourceId: 3,
      transactionUuid: "debt-movement",
      sourceTransactionUuid: "debt-movement",
      accountUuid: "debt",
      epochSeconds: 1_767_312_000,
      localDate: "2026-01-02",
      localTime: "01:00:00",
      valueEpochSeconds: null,
      valueLocalDate: null,
      valueLocalTime: null,
      amountNativeMinor: 2_000,
      amountHomeMinor: 2_000,
      categoryUuid: "category-expense",
      categoryPath: ["Gastos"],
      categoryType: "EXPENSE",
      bucket: "expense",
      status: "UNRECONCILED",
      isVoid: false,
      isArchivedContent: false,
      payeeSourceId: null,
      paymentMethodSourceId: null,
      tagSourceIds: [],
      comment: null,
      referenceNumber: null,
      originalAmountMinor: null,
      originalCurrency: null,
      split: null,
      fxSource: "HOME_CURRENCY",
      exchangeRateToHome: 1,
    },
  ],
  payees: [
    { sourceId: 1, name: "Empresa", shortName: null, parentSourceId: null },
    { sourceId: 2, name: "Tienda", shortName: null, parentSourceId: null },
  ],
  paymentMethods: [],
  tags: [],
  budgets: [],
};

let envelopePromise: Promise<StaticVaultEnvelopeV1> | undefined;

async function appVaultEnvelope(): Promise<StaticVaultEnvelopeV1> {
  const body = new Response(
    new TextEncoder().encode(JSON.stringify(APP_DATASET)),
  ).body;
  if (body === null) throw new Error("Missing compression body");
  const stream = body.pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return await encryptCompressedDataset(
    compressed,
    APP_TEST_PASSPHRASE,
    globalThis.crypto,
  );
}

function getAppVaultEnvelope(): Promise<StaticVaultEnvelopeV1> {
  envelopePromise ??= appVaultEnvelope();
  return envelopePromise;
}

export function installAppFetchMock() {
  const envelope = getAppVaultEnvelope();
  const fetchMock = vi.fn<
    (input: string | URL | Request) => Promise<Response>
  >(async (input) => {
    const pathname = new URL(String(input), "http://localhost").pathname;
    if (!pathname.endsWith("/data/app-dataset.vault.json")) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(JSON.stringify(await envelope), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
