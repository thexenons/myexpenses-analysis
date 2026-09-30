import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BackupDatasetV1 } from "../../../domain/analytics/backup-dataset.types.ts";
import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
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
import type { AppStoreStorage } from "./app-store.types.ts";

const SECURE_ENVIRONMENT = {
  hostname: "finanzas.example",
  isSecureContext: true,
} as const;
const FILTER_PREFERENCES_NAME = "myexpenses-analysis:filters:v1";

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

function datasetWithIdentity(databaseSha256: string): BackupDatasetV1 {
  const base = datasetFixture();
  const posting = base.postings[0]!;
  return {
    ...base,
    source: { ...base.source, databaseSha256 },
    payees: [{ sourceId: 7, name: "Example payee", shortName: null, parentSourceId: null }],
    paymentMethods: [{ sourceId: 9, label: "Example method", type: "EXPENSE", isNumbered: false, icon: null }],
    tags: [{ sourceId: 4, name: "Tagged", color: null }],
    postings: [
      { ...posting, payeeSourceId: 7, paymentMethodSourceId: 9, tagSourceIds: [4] },
      { ...posting, id: "account:missing-identity", sourceId: 2, transactionUuid: "missing-identity",
        sourceTransactionUuid: "missing-identity", payeeSourceId: null, paymentMethodSourceId: null, tagSourceIds: [] },
    ],
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
    expect(VAULT_UNLOCK_ERROR_MESSAGE).toBe("No se pudo abrir la bóveda.");
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
    expect(VAULT_TRANSPORT_ERROR_MESSAGE).toBe("La bóveda no está disponible.");
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

  it("clears an error and invalidates encrypted cache without retrying a phrase", async () => {
    const invalidateCachedVault = vi.fn<() => void>();
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockRejectedValue(new Error("invalid tag")),
      invalidateCachedVault,
    };
    const store = createSecureStore(repository);

    await store.getState().actions.unlock("incorrecta");
    expect(store.getState().loadPhase).toBe("error");
    store.getState().actions.reloadVault();
    expect(invalidateCachedVault).toHaveBeenCalledOnce();
    expect(repository.load).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ loadPhase: "locked", error: null });
  });

  it("keeps filter mutations inside the store action boundary", () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>(),
    };
    const store = createSecureStore(repository);
    expect(store.getState().filters.scope).toBe("realCashFlow");
    store.getState().actions.patchFilters({ scope: "all" });
    expect(store.getState().filters.scope).toBe("all");

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
    expect(store.getState().filters.scope).toBe("realCashFlow");
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
    store.getState().actions.patchFilters({ scope: "all" });
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
      scope: "realCashFlow",
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

  it("does not persist filter edits before a successful unlock", () => {
    const store = createSecureStore({
      load: vi.fn<DatasetRepository["load"]>(),
    });
    const urlBefore = window.location.href;

    store.getState().actions.patchFilters({
      accountIds: ["private-account"],
      categoryPrefixes: [["Salud", "Tratamiento"]],
      dateRange: { from: "2026-01-01", to: "2026-01-31" },
      search: "diagnóstico privado",
      tags: ["confidencial"],
      payeeKeys: ["legacy:private-payee"],
      paymentMethodKeys: ["legacy:private-method"],
      commentSearch: "private-comment",
      referenceSearch: "private-reference",
    });
    store.getState().actions.setGranularity("week");

    const persisted = window.localStorage.getItem(APP_STORE_STORAGE_NAME) ?? "";
    expect(persisted).toContain('"granularity":"week"');
    expect(persisted).not.toMatch(
      /private-account|Salud|Tratamiento|2026-01|diagnóstico|confidencial|private-payee|private-method|private-comment|private-reference/u,
    );
    expect(persisted).not.toContain("filters");
    expect(window.localStorage.getItem(FILTER_PREFERENCES_NAME)).toBeNull();
    expect(window.location.href).toBe(urlBefore);
  });

  it("restores saved global filters only after successful unlock and persists an explicit reset", async () => {
    const repository: DatasetRepository = { load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) };
    const first = createSecureStore(repository);
    await first.getState().actions.unlock("first phrase");
    first.getState().actions.patchFilters({
      scope: "all", search: "mercado", accountIds: ["account"], categoryPrefixes: [["Reajuste*"]],
      periodMode: "custom", dateRange: { from: "2030-02-01", to: "2030-02-28" },
      statuses: ["VOID"], commentSearch: "nota", minAmountEurMinor: 0,
    });
    const saved = window.localStorage.getItem(FILTER_PREFERENCES_NAME) ?? "";
    expect(saved).toContain('"search":"mercado"');
    expect(saved).not.toMatch(/first phrase|analytics|accountLabel|amountEurMinor|VOID/u);
    first.getState().actions.lock();
    expect(first.getState().filters.search).toBe("");
    await first.getState().actions.unlock("same store");
    expect(first.getState().filters.search).toBe("mercado");
    first.getState().actions.reloadVault();
    expect(first.getState().loadPhase).toBe("locked");
    await first.getState().actions.unlock("after reload");
    expect(first.getState().filters.search).toBe("mercado");

    const second = createSecureStore(repository);
    expect(second.getState().filters.search).toBe("");
    await second.getState().actions.unlock("second phrase");
    expect(second.getState().filters).toMatchObject({
      scope: "all", search: "mercado", accountIds: ["account"], categoryPrefixes: [["Reajuste*"]],
      periodMode: "custom", dateRange: { from: "2030-02-01", to: "2030-02-28" },
      statuses: [], commentSearch: "nota", minAmountEurMinor: 0,
    });
    second.getState().actions.clearFilters();
    const third = createSecureStore(repository);
    await third.getState().actions.unlock("third phrase");
    expect(third.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" });
  });

  it("does not apply saved filters after a failed unlock or overwrite future preferences", async () => {
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, JSON.stringify({ version: 99, filters: { search: "future" } }));
    const future = window.localStorage.getItem(FILTER_PREFERENCES_NAME);
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>()
        .mockRejectedValueOnce(new Error("invalid tag"))
        .mockResolvedValue(datasetFixture()),
    };
    const store = createSecureStore(repository);
    await store.getState().actions.unlock("wrong");
    expect(store.getState().filters.search).toBe("");
    expect(window.localStorage.getItem(FILTER_PREFERENCES_NAME)).toBe(future);
    await store.getState().actions.unlock("correct");
    expect(store.getState().filters.search).toBe("");
    store.getState().actions.patchFilters({ search: "changed" });
    expect(window.localStorage.getItem(FILTER_PREFERENCES_NAME)).toBe(future);
  });

  it("preserves an oversized unknown future preference instead of rewriting it", async () => {
    const future = JSON.stringify({ version: 99, filters: { futureSetting: "x".repeat(70_000) } });
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, future);
    const store = createSecureStore({ load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) });
    await store.getState().actions.unlock("phrase");
    expect(store.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" });
    store.getState().actions.patchFilters({ search: "current" });
    expect(window.localStorage.getItem(FILTER_PREFERENCES_NAME)).toBe(future);
  });

  it("does not overwrite a future app-store version while granularity remains usable in memory", async () => {
    const future = JSON.stringify({ version: 99, state: { granularity: "year", futureSetting: "keep" } });
    window.localStorage.setItem(APP_STORE_STORAGE_NAME, future);
    const store = createSecureStore({ load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) });
    await store.persist.rehydrate();
    store.getState().actions.setGranularity("week");
    await store.getState().actions.unlock("phrase");
    expect(store.getState().granularity).toBe("week");
    expect(window.localStorage.getItem(APP_STORE_STORAGE_NAME)).toBe(future);
  });

  it("prunes unavailable criteria from the full new dataset without losing available stable selections", async () => {
    const firstRepository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetWithIdentity("b".repeat(64))),
    };
    const first = createSecureStore(firstRepository);
    await first.getState().actions.unlock("first");
    first.getState().actions.patchFilters({
      scope: "all", search: "no matching activity", accountIds: ["account", "missing"],
      originAccountIds: ["account", "missing"], destinationAccountIds: ["debt", "missing"],
      categoryPrefixes: [["Reajuste*"], ["Gone"]], tags: ["Tagged", "Gone"],
      currencies: ["EUR", "USD"], payeeKeys: ['["source",7]', '["missing"]'],
      paymentMethodKeys: ['["source",9]', '["missing"]'],
    });
    const second = createSecureStore({
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetWithIdentity("c".repeat(64))),
    });
    await second.getState().actions.unlock("second");
    expect(second.getState().filters).toMatchObject({
      scope: "all", search: "no matching activity", accountIds: ["account"],
      originAccountIds: ["account"], destinationAccountIds: ["debt"],
      categoryPrefixes: [["Reajuste*"]], tags: ["Tagged"], currencies: ["EUR"],
      payeeKeys: ['["missing"]'], paymentMethodKeys: ['["missing"]'], statuses: [],
    });
    const third = createSecureStore({
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetWithIdentity("c".repeat(64))),
    });
    await third.getState().actions.unlock("third");
    expect(third.getState().filters.payeeKeys).toEqual(['["missing"]']);
  });

  it("retains numeric identity keys only when the exact database hash is trusted", async () => {
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetWithIdentity("b".repeat(64))),
    };
    const first = createSecureStore(repository);
    await first.getState().actions.unlock("first");
    first.getState().actions.patchFilters({ payeeKeys: ['["source",7]'], paymentMethodKeys: ['["source",9]'] });
    const second = createSecureStore(repository);
    await second.getState().actions.unlock("second");
    expect(second.getState().filters.payeeKeys).toEqual(['["source",7]']);
    expect(second.getState().filters.paymentMethodKeys).toEqual(['["source",9]']);
  });

  it("drops malformed dates, forbidden statuses and corrupt snapshots without blocking unlock", async () => {
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, JSON.stringify({
      version: 1, databaseSha256: "b".repeat(64),
      filters: { scope: "all", periodMode: "custom", dateRange: { from: "2026-02-30", to: "2026-03-01" },
        search: "keep", statuses: ["VOID"] },
    }));
    const repository: DatasetRepository = { load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) };
    const first = createSecureStore(repository);
    await first.getState().actions.unlock("first");
    expect(first.getState().filters).toMatchObject({ search: "keep", periodMode: "all", dateRange: { from: null, to: null }, statuses: [] });
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, JSON.stringify({
      version: 1, databaseSha256: "b".repeat(64),
      filters: { scope: "all", periodMode: "custom", dateRange: { from: "2026-03-01", to: "2026-02-01" },
        search: "reversed" },
    }));
    const reversed = createSecureStore(repository);
    await reversed.getState().actions.unlock("reversed");
    expect(reversed.getState().filters).toMatchObject({ search: "reversed", periodMode: "all", dateRange: { from: null, to: null } });
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, "{broken json");
    const second = createSecureStore(repository);
    await second.getState().actions.unlock("second");
    expect(second.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" });
  });

  it("falls back to app defaults for an incomplete versioned filter envelope", async () => {
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, JSON.stringify({
      version: 1, filters: { scope: 7, periodMode: "unknown", dateRange: null, search: "not trustworthy" },
    }));
    const store = createSecureStore({ load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) });
    await store.getState().actions.unlock("phrase");
    expect(store.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" });
  });

  it("discards numeric identity keys when a saved database fingerprint is absent", async () => {
    window.localStorage.setItem(FILTER_PREFERENCES_NAME, JSON.stringify({
      version: 1,
      filters: { scope: "all", periodMode: "all", dateRange: { from: null, to: null },
        payeeKeys: ['["source",7]', '["missing"]'], paymentMethodKeys: ['["source",9]'] },
    }));
    const store = createSecureStore({ load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetWithIdentity("b".repeat(64))) });
    await store.getState().actions.unlock("phrase");
    expect(store.getState().filters.payeeKeys).toEqual(['["missing"]']);
    expect(store.getState().filters.paymentMethodKeys).toEqual([]);
  });

  it("keeps unlock and filters usable when storage throws or rejects", async () => {
    const values = new Map<string, string>();
    const storage: AppStoreStorage = {
      getItem: vi.fn<AppStoreStorage["getItem"]>((name: string) => name === FILTER_PREFERENCES_NAME
        ? Promise.reject(new Error("blocked read")) : values.get(name) ?? null),
      setItem: vi.fn<AppStoreStorage["setItem"]>((name: string, value: string) => {
        if (name === FILTER_PREFERENCES_NAME) return Promise.reject(new Error("quota"));
        values.set(name, value);
      }),
      removeItem: vi.fn<AppStoreStorage["removeItem"]>(() => { throw new Error("blocked remove"); }),
    };
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) },
      storage,
      SECURE_ENVIRONMENT,
    );
    await store.getState().actions.unlock("phrase");
    expect(store.getState().loadPhase).toBe("ready");
    store.getState().actions.patchFilters({ search: "usable" });
    expect(store.getState().filters.search).toBe("usable");
    store.getState().actions.clearFilters();
    expect(store.getState().filters.search).toBe("");
    store.getState().actions.lock();
    expect(store.getState().loadPhase).toBe("locked");
  });

  it("survives blocked storage getters and oversized preference cleanup", async () => {
    const blocked = new Proxy({} as AppStoreStorage, {
      get() { throw new Error("storage unavailable"); },
    });
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) },
      blocked,
      SECURE_ENVIRONMENT,
    );
    await store.getState().actions.unlock("phrase");
    expect(store.getState().loadPhase).toBe("ready");
    store.getState().actions.patchFilters({ search: "x".repeat(70_000) });
    expect(store.getState().filters.search).toHaveLength(70_000);
    store.getState().actions.clearFilters();
    expect(store.getState().filters.search).toBe("");
  });

  it("never saves a partial selection when the preference budget is exceeded", async () => {
    const repository: DatasetRepository = { load: vi.fn<DatasetRepository["load"]>().mockResolvedValue(datasetFixture()) };
    const store = createSecureStore(repository);
    await store.getState().actions.unlock("phrase");
    store.getState().actions.patchFilters({ search: "before" });
    expect(window.localStorage.getItem(FILTER_PREFERENCES_NAME)).not.toBeNull();
    store.getState().actions.setTags(Array.from({ length: 101 }, (_, index) => `tag-${index}`));
    expect(window.localStorage.getItem(FILTER_PREFERENCES_NAME)).toBeNull();
    const next = createSecureStore(repository);
    await next.getState().actions.unlock("next");
    expect(next.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" });
  });

  it("clears in-memory financial criteria on lock while keeping granularity", () => {
    const store = createSecureStore({ load: vi.fn<DatasetRepository["load"]>() });
    store.getState().actions.patchFilters({ search: "private", payeeKeys: ["legacy:private"], minAmountEurMinor: 0 });
    store.getState().actions.setGranularity("week");
    store.getState().actions.lock();
    expect(store.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" });
    expect(store.getState().granularity).toBe("week");
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

  it("reload aborts an in-flight unlock and prevents its stale success", async () => {
    let resolveDataset: ((dataset: BackupDatasetV1) => void) | undefined;
    const invalidateCachedVault = vi.fn<() => void>();
    const repository: DatasetRepository = {
      load: vi.fn<DatasetRepository["load"]>(async (_passphrase, signal) =>
        await new Promise<BackupDatasetV1>((resolve, reject) => {
          resolveDataset = resolve;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })),
      invalidateCachedVault,
    };
    const store = createSecureStore(repository);
    const pending = store.getState().actions.unlock("correcta");
    store.getState().actions.reloadVault();
    resolveDataset?.(datasetFixture());
    await pending;
    expect(invalidateCachedVault).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ analytics: null, error: null, loadPhase: "locked" });
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
    expect(INSECURE_CONTEXT_MESSAGE).toBe("No se puede abrir la bóveda en este contexto.");
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
