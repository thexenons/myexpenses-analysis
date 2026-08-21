import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import type { FilterState } from "../../../domain/analytics/types.ts";
import type { DatasetRepository } from "../../ports/dataset-repository.ts";
import { loadAnalytics } from "../../use-cases/load-analytics.ts";
import {
  APP_STORE_STORAGE_NAME,
  APP_STORE_STORAGE_VERSION,
  appStoreErrorMessage,
  reconcileFilterAccounts,
  restoreAppStorePersistedState,
} from "./app-store.helpers.ts";
import type {
  AppStoreActions,
  AppStoreState,
  AppStoreStorage,
} from "./app-store.types.ts";

export function createAppStore(
  repository: DatasetRepository,
  storage: AppStoreStorage,
) {
  let activeController: AbortController | null = null;

  return createStore<AppStoreState>()(
    persist(
      (set, get) => {
        const actions: AppStoreActions = {
          clearFilters: () => set({ filters: createDefaultFilterState() }),
          closeFilterDrawer: () => set({ filterDrawerOpen: false }),
          initialize: async (force = false) => {
            const state = get();
            if (
              !force &&
              (state.loadPhase === "loading" || state.loadPhase === "ready")
            ) {
              return;
            }

            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            set({ loadPhase: "loading", error: null });

            try {
              const loaded = await loadAnalytics(repository, controller.signal);
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
              set({ loadPhase: "error", error: appStoreErrorMessage(error) });
            } finally {
              if (activeController === controller) activeController = null;
            }
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
          setCategoryPrefix: (categoryPrefix) =>
            set((state) => ({
              filters: {
                ...state.filters,
                categoryPrefix: [...categoryPrefix],
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
        };

        return {
          actions,
          analytics: null,
          error: null,
          filterDrawerOpen: false,
          filters: createDefaultFilterState(),
          granularity: "month",
          loadPhase: "idle",
        };
      },
      {
        name: APP_STORE_STORAGE_NAME,
        version: APP_STORE_STORAGE_VERSION,
        storage: createJSONStorage(() => storage),
        migrate: (persistedState) =>
          restoreAppStorePersistedState(persistedState),
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...restoreAppStorePersistedState(persistedState),
        }),
        partialize: (state) => ({
          filters: state.filters,
          granularity: state.granularity,
        }),
      },
    ),
  );
}
