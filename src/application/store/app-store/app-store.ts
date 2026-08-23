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

export function createAppStore(
  repository: DatasetRepository,
  storage: AppStoreStorage,
  environment: AppStoreEnvironment = defaultAppStoreEnvironment(),
) {
  let activeController: AbortController | null = null;
  const blockedReason = unlockBlockedReason(environment);

  return createStore<AppStoreState>()(
    persist(
      (set) => {
        const actions: AppStoreActions = {
          clearFilters: () => set({ filters: createDefaultFilterState() }),
          closeFilterDrawer: () => set({ filterDrawerOpen: false }),
          lock: () => {
            activeController?.abort();
            activeController = null;
            set({
              analytics: null,
              error: null,
              filterDrawerOpen: false,
              loadPhase: "locked",
            });
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
              set((current) => ({
                analytics: loaded.analytics,
                filters: reconcileFilterAccounts(
                  current.filters,
                  loaded.analytics,
                ),
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
          filters: createDefaultFilterState(),
          granularity: "auto",
          loadPhase: "locked",
          unlockBlockedReason: blockedReason,
        };
      },
      {
        name: APP_STORE_STORAGE_NAME,
        version: APP_STORE_STORAGE_VERSION,
        storage: createJSONStorage(() => storage),
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
}
