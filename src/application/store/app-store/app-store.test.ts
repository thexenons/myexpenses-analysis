import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BackupDatasetV1 } from "../../../domain/analytics/backup-dataset.types.ts";
import {
  DatasetTransportError,
  type DatasetRepository,
} from "../../ports/dataset-repository.ts";
import {
  APP_STORE_STORAGE_NAME,
  INSECURE_CONTEXT_MESSAGE,
  VAULT_TRANSPORT_ERROR_MESSAGE,
  VAULT_UNLOCK_ERROR_MESSAGE,
} from "./app-store.helpers.ts";
import { createAppStore } from "./app-store.ts";

const SECURE_ENVIRONMENT = {
  hostname: "finanzas.example",
  isSecureContext: true,
} as const;

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
        uuid: "account",
        sourceId: 1,
        label: "Cuenta",
        description: null,
        currency: "EUR",
        fractionDigits: 2,
        nativeType: "CASH",
        scope: "DEFAULT",
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
          isAsset: true,
          supportsReconciliation: false,
        },
      },
      {
        uuid: "debt",
        sourceId: 2,
        label: "Deuda",
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
          supportsReconciliation: false,
        },
      },
    ],
    categories: [
      {
        uuid: "neutral",
        sourceId: 1,
        name: "Reajuste*",
        type: "NEUTRAL",
        parentUuid: null,
        path: ["Reajuste*"],
        color: null,
        icon: null,
      },
    ],
    postings: [
      {
        id: "account:posting",
        sourceId: 1,
        transactionUuid: "posting",
        sourceTransactionUuid: "posting",
        accountUuid: "account",
        epochSeconds: 1_767_225_600,
        localDate: "2026-01-01",
        localTime: "01:00:00",
        valueEpochSeconds: null,
        valueLocalDate: null,
        valueLocalTime: null,
        amountNativeMinor: 1_000,
        amountHomeMinor: 1_000,
        categoryUuid: "neutral",
        categoryPath: ["Reajuste*"],
        categoryType: "NEUTRAL",
        bucket: "income",
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
    payees: [],
    paymentMethods: [],
    tags: [],
    budgets: [],
  };
}

function createSecureStore(repository: DatasetRepository) {
  return createAppStore(
    repository,
    window.localStorage,
    SECURE_ENVIRONMENT,
  );
}

describe("AppStore", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts locked and does not request data before an explicit unlock", async () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()),
    };
    const store = createSecureStore(repository);

    expect(store.getState().loadPhase).toBe("locked");
    expect(store.getState().granularity).toBe("auto");
    expect(repository.load).not.toHaveBeenCalled();

    const unlock = store.getState().actions.unlock("frase robusta");
    expect(store.getState().loadPhase).toBe("unlocking");
    await unlock;

    expect(repository.load).toHaveBeenCalledWith(
      "frase robusta",
      expect.any(AbortSignal),
    );
    expect(store.getState().loadPhase).toBe("ready");
    expect(store.getState().analytics?.postings).toHaveLength(1);
  });

  it("uses one indistinguishable error for a wrong phrase or corrupt vault", async () => {
    const repository: DatasetRepository = {
      load: vi
        .fn<DatasetRepository["load"]>()
        .mockRejectedValueOnce(new Error("authentication tag mismatch"))
        .mockRejectedValueOnce(new Error("corrupt gzip payload")),
    };
    const store = createSecureStore(repository);

    await store.getState().actions.unlock("incorrecta");

    expect(store.getState()).toMatchObject({
      analytics: null,
      loadPhase: "error",
      error: VAULT_UNLOCK_ERROR_MESSAGE,
    });
    expect(store.getState().error).not.toContain("authentication");

    await store.getState().actions.unlock("otra frase");
    expect(store.getState().error).toBe(VAULT_UNLOCK_ERROR_MESSAGE);
    expect(store.getState().error).not.toContain("gzip");
  });

  it("keeps transport failures actionable without exposing crypto diagnostics", async () => {
    const repository: DatasetRepository = {
      load: vi
        .fn<DatasetRepository["load"]>()
        .mockRejectedValue(
          new DatasetTransportError("Could not fetch vault: HTTP 404"),
        ),
    };
    const store = createSecureStore(repository);

    await store.getState().actions.unlock("frase no relevante");

    expect(store.getState()).toMatchObject({
      analytics: null,
      loadPhase: "error",
      error: VAULT_TRANSPORT_ERROR_MESSAGE,
    });
    expect(store.getState().error).not.toContain("404");
  });

  it("keeps filter mutations inside the store action boundary", () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>(),
    };
    const store = createSecureStore(repository);

    store.getState().actions.patchFilters({ search: "mercado" });
    store.getState().actions.setAccountIds(["one", "two"]);
    store.getState().actions.setDatePeriod("month", {
      from: "2026-04-01",
      to: "2026-04-30",
    });
    store.getState().actions.openFilterDrawer();

    expect(store.getState().filters.search).toBe("mercado");
    expect(store.getState().filters.accountIds).toEqual(["one", "two"]);
    expect(store.getState().filters).toMatchObject({
      periodMode: "month",
      dateRange: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(store.getState().filterDrawerOpen).toBe(true);

    store.getState().actions.clearFilters();
    expect(store.getState().filters.search).toBe("");
    expect(store.getState().filters).toMatchObject({
      periodMode: "all",
      dateRange: { from: null, to: null },
    });
  });

  it("prunes stale and scope-incompatible account filters after unlock", async () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()),
    };
    const store = createSecureStore(repository);
    store.getState().actions.setAccountIds(["account", "debt", "missing"]);

    await store.getState().actions.unlock("correcta");

    expect(store.getState().filters.accountIds).toEqual(["account", "debt"]);
    store.getState().actions.patchFilters({ scope: "realCashFlow" });
    expect(store.getState().filters.accountIds).toEqual(["account"]);
    store.getState().actions.setAccountIds(["account", "debt"]);
    expect(store.getState().filters.accountIds).toEqual(["account"]);
    store.getState().actions.patchFilters({ scope: "debtsOnly" });
    expect(store.getState().filters.accountIds).toEqual([]);
  });

  it("migrates only non-sensitive UI preferences and never persists the passphrase", async () => {
    window.localStorage.setItem(
      APP_STORE_STORAGE_NAME,
      JSON.stringify({
        version: 1,
        state: {
          filters: {
            scope: "debtsOnly",
            dateRange: { from: "not-a-date", to: "2026-01-31" },
            accountIds: ["debt", "missing", 42],
            statuses: ["VOID", "UNKNOWN"],
            search: 42,
          },
          granularity: "week",
          page: "unknown",
        },
      }),
    );
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()),
    };
    const store = createSecureStore(repository);
    await store.persist.rehydrate();

    expect(store.getState().filters).toMatchObject({
      scope: "all",
      dateRange: { from: null, to: null },
      accountIds: [],
      statuses: [],
      search: "",
      linked: "all",
    });
    expect(store.getState().granularity).toBe("auto");
    expect(window.localStorage.getItem(APP_STORE_STORAGE_NAME) ?? "").not.toMatch(
      /debt|2026-01|VOID/u,
    );

    await store.getState().actions.unlock("no guardar esta frase");
    const persisted = window.localStorage.getItem(APP_STORE_STORAGE_NAME) ?? "";
    expect(persisted).not.toContain("no guardar esta frase");
    expect(persisted).not.toContain("analytics");
    expect(store.getState().filters.accountIds).toEqual([]);
  });

  it("keeps descriptive financial filters out of browser persistence", () => {
    const store = createSecureStore({
      load: vi.fn<DatasetRepository["load"]>(),
    });

    store.getState().actions.patchFilters({
      accountIds: ["private-account"],
      categoryPrefixes: [["Salud", "Tratamiento"]],
      dateRange: { from: "2026-01-01", to: "2026-01-31" },
      search: "diagnóstico privado",
      tags: ["confidencial"],
    });
    store.getState().actions.setGranularity("week");

    const persisted = window.localStorage.getItem(APP_STORE_STORAGE_NAME) ?? "";
    expect(persisted).toContain('"granularity":"week"');
    expect(persisted).not.toMatch(
      /private-account|Salud|Tratamiento|2026-01|diagnóstico|confidencial/u,
    );
    expect(persisted).not.toContain("filters");
  });

  it("lock aborts work and removes analytics and errors", async () => {
    let resolveDataset: ((dataset: BackupDatasetV1) => void) | undefined;
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>(
        async (_passphrase, signal) =>
          await new Promise<BackupDatasetV1>((resolve, reject) => {
            resolveDataset = resolve;
            signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    };
    const store = createSecureStore(repository);

    const pending = store.getState().actions.unlock("correcta");
    store.getState().actions.lock();
    resolveDataset?.(datasetFixture());
    await pending;

    expect(store.getState()).toMatchObject({
      analytics: null,
      error: null,
      loadPhase: "locked",
    });
  });

  it("lock discards an already decrypted analytics graph", async () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()),
    };
    const store = createSecureStore(repository);
    await store.getState().actions.unlock("correcta");
    expect(store.getState().analytics).not.toBeNull();
    store.setState({ error: "stale diagnostic" });

    store.getState().actions.lock();

    expect(store.getState()).toMatchObject({
      analytics: null,
      error: null,
      filterDrawerOpen: false,
      loadPhase: "locked",
    });
  });

  it("blocks remote insecure contexts before repository access", async () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>(),
    };
    const store = createAppStore(repository, window.localStorage, {
      hostname: "finanzas.example",
      isSecureContext: false,
    });

    await store.getState().actions.unlock("no debe salir");

    expect(repository.load).not.toHaveBeenCalled();
    expect(store.getState().loadPhase).toBe("locked");
    expect(store.getState().unlockBlockedReason).toBe(INSECURE_CONTEXT_MESSAGE);
  });

  it("permits localhost even when the test environment lacks secure-context metadata", async () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()),
    };
    const store = createAppStore(repository, window.localStorage, {
      hostname: "localhost",
      isSecureContext: false,
    });

    await store.getState().actions.unlock("local");

    expect(repository.load).toHaveBeenCalledOnce();
    expect(store.getState().loadPhase).toBe("ready");
  });
});
