import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import type { FilterState } from "../../../domain/analytics/types.ts";
import {
  DatasetTransportError,
  type DatasetRepository,
} from "../../ports/dataset-repository.ts";
import {
  unlockAnalytics,
  unlockAnalyticsForRemembering,
  unlockRememberedAnalytics,
} from "../../use-cases/unlock-analytics.ts";
import {
  APP_STORE_STORAGE_NAME,
  APP_STORE_STORAGE_VERSION,
  REMEMBERED_LOCK_CHANNEL,
  REMEMBERED_LOCK_MARKER,
  REMEMBERED_LOCK_SENDER,
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
  RememberedVaultStorage,
} from "./app-store.types.ts";
import { readFilterPreferences, reconcileSavedFilters, saveFilterPreferences } from "./filter-preferences.ts";

const REMEMBER_SAVE_FAILED = "La bóveda está abierta, pero no se pudo recordar este dispositivo.";
const REMEMBER_REVOKE_FAILED = "La bóveda está bloqueada, pero no se pudo confirmar que este dispositivo haya olvidado el acceso. Borra los datos del sitio.";

function durableLockStorage(): Storage | null {
  try { return globalThis.localStorage ?? null; }
  catch { return null; }
}

function readLockMarker(): string | null | undefined {
  try { return durableLockStorage()?.getItem(REMEMBERED_LOCK_MARKER); }
  catch { return undefined; }
}

function writeLockMarker(): boolean {
  try {
    const token = crypto.randomUUID();
    durableLockStorage()?.setItem(REMEMBERED_LOCK_MARKER, token);
    return readLockMarker() === token;
  } catch { return false; }
}

function clearLockMarker(expected: string | null): boolean {
  try {
    if (readLockMarker() !== expected) return false;
    durableLockStorage()?.removeItem(REMEMBERED_LOCK_MARKER);
    return readLockMarker() === null;
  } catch { return false; }
}

function broadcastLock(): void {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(REMEMBERED_LOCK_CHANNEL);
    channel.postMessage({ kind: "locked", sender: REMEMBERED_LOCK_SENDER });
    channel.close();
  } catch { /* The durable fence remains authoritative. */ }
}

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
  rememberedStorage?: RememberedVaultStorage,
) {
  let activeController: AbortController | null = null;
  let startupAttempted = false;
  let preserveFutureFilterPreferences = false;
  const safeStorage = safeAppStoreStorage(storage);
  const blockedReason = unlockBlockedReason(environment);

  const store = createStore<AppStoreState>()(
    persist(
      (set) => {
        const clearLive = () => {
          activeController?.abort();
          activeController = null;
          set((state) => ({
            analytics: null,
            error: null,
            notice: null,
            filterDrawerOpen: false,
            filters: { ...createDefaultFilterState(), scope: DEFAULT_APP_SCOPE },
            filterResetRevision: state.filterResetRevision + 1,
            loadPhase: "locked",
          }));
        };
        const finishUnlock = async (
          analytics: AppStoreState["analytics"],
          controller: AbortController,
          remembered?: { storage: RememberedVaultStorage; generation: number; fence: string | null },
        ) => {
          if (analytics === null || controller.signal.aborted || activeController !== controller) return false;
          const saved = await readFilterPreferences(safeStorage);
          if (remembered) {
            const currentFence = await remembered.storage.captureFence(remembered.generation).catch(() => null);
            if (currentFence?.token !== remembered.fence) return false;
          }
          if (controller.signal.aborted || activeController !== controller) return false;
          if (remembered && (readLockMarker() !== null || !remembered.storage.isCurrent(remembered.generation))) return false;
          preserveFutureFilterPreferences = saved.kind === "future";
          set((current) => ({
            analytics,
            filters: saved.kind === "saved"
              ? reconcileSavedFilters(saved.value, analytics)
              : reconcileFilterAccounts(current.filters, analytics),
            loadPhase: "ready",
            error: null,
          }));
          return true;
        };
        const actions: AppStoreActions = {
          clearFilters: () => set((state) => ({ filters: { ...createDefaultFilterState(), scope: DEFAULT_APP_SCOPE }, filterResetRevision: state.filterResetRevision + 1 })),
          closeFilterDrawer: () => set({ filterDrawerOpen: false }),
          lock: async () => {
            clearLive();
            if (!rememberedStorage) return true;
            // Never trust the UI-preferences overlay as evidence of durable revocation.
            const marker = writeLockMarker();
            broadcastLock();
            const revoked = await rememberedStorage.revoke().catch(() => false);
            if (!revoked || !marker) {
              set({ notice: REMEMBER_REVOKE_FAILED });
            }
            return revoked;
          },
          receiveRevocation: () => {
            startupAttempted = true;
            clearLive();
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
          restoreRemembered: async () => {
            if (startupAttempted || blockedReason !== null || !rememberedStorage || !repository.loadRemembered) return;
            startupAttempted = true;
            if (store.getState().loadPhase !== "locked") return;
            const controller = new AbortController();
            activeController = controller;
            const generation = rememberedStorage.generation();
            try {
              if (readLockMarker() !== null || controller.signal.aborted) return;
              const saved = await rememberedStorage.read(generation);
              if (!saved || controller.signal.aborted || !rememberedStorage.isCurrent(generation)) return;
              set({ loadPhase: "unlocking", error: null, notice: null });
              const loaded = await unlockRememberedAnalytics(repository, saved.key, saved.digest, controller.signal);
              if (!loaded || controller.signal.aborted) return;
              const fence = await rememberedStorage.captureFence(generation);
              if (fence?.token !== saved.fence || !rememberedStorage.isCurrent(generation)) return;
              if (readLockMarker() !== null) return;
              await finishUnlock(loaded.analytics, controller, {
                storage: rememberedStorage, generation, fence: saved.fence,
              });
            } catch {
              // Missing/changed/corrupt remembered access always falls back to manual unlock.
            } finally {
              if (activeController === controller) {
                activeController = null;
                if (store.getState().loadPhase === "unlocking") set({ loadPhase: "locked", error: null });
              }
            }
          },
          unlock: async (passphrase, remember = false) => {
            if (blockedReason !== null) return;
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            set({ analytics: null, error: null, notice: null, loadPhase: "unlocking" });

            try {
              const canRemember = remember && rememberedStorage && repository.loadForRemembering;
              const generation = rememberedStorage?.generation();
              const originalMarker = remember ? readLockMarker() : null;
              const fencePromise = canRemember && generation !== undefined
                ? rememberedStorage.captureFence(generation).catch(() => null)
                : null;
              const loaded = canRemember
                ? await unlockAnalyticsForRemembering(repository, passphrase, controller.signal)
                : await unlockAnalytics(repository, passphrase, controller.signal);
              if (!await finishUnlock(loaded.analytics, controller)) return;
              if (!remember) return;
              const fence = await fencePromise;
              if (controller.signal.aborted || activeController !== controller) return;
              const remembered = canRemember && generation !== undefined && fence !== null &&
                originalMarker !== undefined && readLockMarker() === originalMarker &&
                "key" in loaded && loaded.key instanceof CryptoKey &&
                "digest" in loaded && typeof loaded.digest === "string" &&
                await rememberedStorage.save(generation, loaded.digest, loaded.key, fence.token).catch(() => false);
              if (!remembered) {
                set({ notice: REMEMBER_SAVE_FAILED });
                return;
              }
              if (!clearLockMarker(originalMarker!)) {
                await rememberedStorage.revoke().catch(() => false);
                if (!controller.signal.aborted) set({ notice: REMEMBER_SAVE_FAILED });
              }
            } catch (error) {
              if (controller.signal.aborted) return;
              set({
                analytics: null,
                loadPhase: "error",
                notice: null,
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
          notice: null,
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
