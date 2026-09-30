import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import type { FilterState } from "../../../domain/analytics/types.ts";
import {
  DatasetTransportError,
  type DatasetRepository,
} from "../../ports/dataset-repository.ts";
import { unlockAnalytics } from "../../use-cases/unlock-analytics.ts";
import {
  APP_STORE_STORAGE_NAME,
  APP_STORE_STORAGE_VERSION,
  DEFAULT_APP_SCOPE,
  VAULT_TRANSPORT_ERROR_MESSAGE,
  VAULT_UNLOCK_ERROR_MESSAGE,
  defaultAppStoreEnvironment,
  reconcileFilterAccounts,
  restoreAppStorePersistedState,
  unlockBlockedReason,
} from "./app-store.helpers.ts";
import type {
  AppStoreActions,
  AppStoreEnvironment,
  AppStoreState,
  AppStoreStorage,
} from "./app-store.types.ts";
import { readFilterPreferences, reconcileSavedFilters, saveFilterPreferences } from "./filter-preferences.ts";

function isPromise<Value>(value: Value | Promise<Value>): value is Promise<Value> {
  return typeof value === "object" && value !== null && "then" in value;
}

function isFutureUiState(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && "version" in value &&
      typeof value.version === "number" && value.version > APP_STORE_STORAGE_VERSION;
  } catch {
    return false;
  }
}

/** Keep browser exceptions from escaping Zustand, including future-version writes. */
function safeAppStoreStorage(storage: AppStoreStorage): AppStoreStorage {
  const read = (name: string) => {
    try {
      const result = storage.getItem(name);
      return isPromise(result) ? result.catch(() => null) : result;
    } catch {
      return null;
    }
  };
  const write = (name: string, value: string) => {
    try {
      const result = storage.setItem(name, value);
      return isPromise(result) ? result.catch(() => undefined) : result;
    } catch {
      return;
    }
  };
  return {
    getItem: read,
    setItem(name, value) {
      if (name !== APP_STORE_STORAGE_NAME) return write(name, value);
      const existing = read(name);
      return isPromise(existing)
        ? existing.then((raw) => isFutureUiState(raw) ? undefined : write(name, value))
        : isFutureUiState(existing) ? undefined : write(name, value);
    },
    removeItem(name) {
      const remove = () => {
        try {
          const result = storage.removeItem(name);
          return isPromise(result) ? result.catch(() => undefined) : result;
        } catch {
          return;
        }
      };
      if (name !== APP_STORE_STORAGE_NAME) return remove();
      const existing = read(name);
      return isPromise(existing)
        ? existing.then((raw) => isFutureUiState(raw) ? undefined : remove())
        : isFutureUiState(existing) ? undefined : remove();
    },
  };
}

export function createAppStore(
  repository: DatasetRepository,
  storage: AppStoreStorage,
  environment: AppStoreEnvironment = defaultAppStoreEnvironment(),
) {
  let activeController: AbortController | null = null;
  let preserveFutureFilterPreferences = false;
  const safeStorage = safeAppStoreStorage(storage);
  const blockedReason = unlockBlockedReason(environment);

  const store = createStore<AppStoreState>()(
    persist(
      (set) => {
        const actions: AppStoreActions = {
          clearFilters: () => set((state) => ({ filters: { ...createDefaultFilterState(), scope: DEFAULT_APP_SCOPE }, filterResetRevision: state.filterResetRevision + 1 })),
          closeFilterDrawer: () => set({ filterDrawerOpen: false }),
          lock: () => {
            activeController?.abort();
            activeController = null;
            set((state) => ({
              analytics: null,
              error: null,
              filterDrawerOpen: false,
              filters: { ...createDefaultFilterState(), scope: DEFAULT_APP_SCOPE },
              filterResetRevision: state.filterResetRevision + 1,
              loadPhase: "locked",
            }));
          },
          openFilterDrawer: () => set({ filterDrawerOpen: true }),
          patchFilters: (patch) =>
            set((state) => {
              const filters: FilterState = {
                ...state.filters,
                ...patch,
                dateRange: patch.dateRange ?? state.filters.dateRange,
              };
              return {
                filters: reconcileFilterAccounts(filters, state.analytics),
              };
            }),
          reloadVault: () => {
            activeController?.abort();
            activeController = null;
            repository.invalidateCachedVault?.();
            set({ analytics: null, error: null, loadPhase: "locked" });
          },
          setAccountIds: (accountIds) =>
            set((state) => ({
              filters: reconcileFilterAccounts(
                { ...state.filters, accountIds: [...accountIds] },
                state.analytics,
              ),
            })),
          setDatePeriod: (periodMode, dateRange) =>
            set((state) => ({
              filters: {
                ...state.filters,
                periodMode,
                dateRange: { ...dateRange },
              },
            })),
          setCategoryPrefixes: (categoryPrefixes) =>
            set((state) => ({
              filters: {
                ...state.filters,
                categoryPrefixes: categoryPrefixes.map((path) => [...path]),
              },
            })),
          setGranularity: (granularity) => set({ granularity }),
          setStatuses: (statuses) =>
            set((state) => ({
              filters: { ...state.filters, statuses: [...statuses] },
            })),
          setTags: (tags) =>
            set((state) => ({
              filters: { ...state.filters, tags: [...tags] },
            })),
          unlock: async (passphrase) => {
            if (blockedReason !== null) return;
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            set({ analytics: null, error: null, loadPhase: "unlocking" });

            try {
              const loaded = await unlockAnalytics(
                repository,
                passphrase,
                controller.signal,
              );
              if (controller.signal.aborted) return;
              const saved = await readFilterPreferences(safeStorage);
              if (controller.signal.aborted) return;
              preserveFutureFilterPreferences = saved.kind === "future";
              set((current) => ({
                analytics: loaded.analytics,
                filters: saved.kind === "saved"
                  ? reconcileSavedFilters(saved.value, loaded.analytics)
                  : reconcileFilterAccounts(current.filters, loaded.analytics),
                loadPhase: "ready",
                error: null,
              }));
            } catch (error) {
              if (controller.signal.aborted) return;
              set({
                analytics: null,
                loadPhase: "error",
                error:
                  error instanceof DatasetTransportError
                    ? VAULT_TRANSPORT_ERROR_MESSAGE
                    : VAULT_UNLOCK_ERROR_MESSAGE,
              });
            } finally {
              if (activeController === controller) activeController = null;
            }
          },
        };

        return {
          actions,
          analytics: null,
          error: null,
          filterDrawerOpen: false,
          filterResetRevision: 0,
          filters: { ...createDefaultFilterState(), scope: DEFAULT_APP_SCOPE },
          granularity: "auto",
          loadPhase: "locked",
          unlockBlockedReason: blockedReason,
        };
      },
      {
        name: APP_STORE_STORAGE_NAME,
        version: APP_STORE_STORAGE_VERSION,
        storage: createJSONStorage(() => safeStorage),
        migrate: (persistedState, version) =>
          version < APP_STORE_STORAGE_VERSION
            ? { granularity: "auto" }
            : restoreAppStorePersistedState(persistedState),
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...restoreAppStorePersistedState(persistedState),
        }),
        partialize: (state) => ({
          granularity: state.granularity,
        }),
      },
    ),
  );
  store.subscribe((state, previous) => {
    if (state.loadPhase !== "ready" || state.analytics === null || preserveFutureFilterPreferences) return;
    if (state.filters !== previous.filters || previous.loadPhase !== "ready") {
      saveFilterPreferences(safeStorage, state.filters, state.analytics);
    }
  });
  return store;
}
