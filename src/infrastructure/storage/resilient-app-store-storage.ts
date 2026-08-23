import type { AppStoreStorage } from "../../application/store/app-store/app-store.types.ts";

export interface BrowserStorageLike {
  getItem(name: string): string | null;
  removeItem(name: string): void;
  setItem(name: string, value: string): void;
}

/**
 * Keeps non-sensitive UI preferences usable when browser storage is blocked,
 * unavailable in private mode, or out of quota.
 */
export function createResilientAppStoreStorage(
  resolveStorage: () => BrowserStorageLike = () => globalThis.localStorage,
): AppStoreStorage {
  const overlay = new Map<string, string | null>();
  return {
    getItem(name) {
      if (overlay.has(name)) return overlay.get(name) ?? null;
      try {
        return resolveStorage().getItem(name);
      } catch {
        return null;
      }
    },
    removeItem(name) {
      overlay.set(name, null);
      try {
        resolveStorage().removeItem(name);
      } catch {
        // In-memory state is already consistent for this session.
      }
    },
    setItem(name, value) {
      overlay.set(name, value);
      try {
        resolveStorage().setItem(name, value);
      } catch {
        // Quota/privacy failures fall back to session-only persistence.
      }
    },
  };
}
