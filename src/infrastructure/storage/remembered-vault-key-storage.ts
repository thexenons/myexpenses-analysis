import { isVaultDecryptionKey } from "../../domain/security/static-vault.ts";

const DATABASE_NAME = "myexpenses-remembered-vault";
const STORE_NAME = "key";
const RECORD_ID = "current";
const RECORD_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 1_500;

export interface RememberedVaultKey {
  readonly digest: string;
  readonly key: CryptoKey;
}

interface StoredKey extends RememberedVaultKey {
  readonly version: number;
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validRecord(value: unknown): value is StoredKey {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredKey>;
  return candidate.version === RECORD_VERSION &&
    validDigest(candidate.digest) && isVaultDecryptionKey(candidate.key);
}

/**
 * Origin-local best-effort storage. Capture a generation before async unlock;
 * revocation invalidates it synchronously and serializes deletion after writes.
 * Callers must await revoke before reporting a completed lock/navigation.
 */
export class RememberedVaultKeyStorage {
  private readonly factory: IDBFactory | undefined;
  private readonly timeoutMs: number;
  private epoch = 0;
  private pending: Promise<void> = Promise.resolve();

  constructor(factory: IDBFactory | undefined = globalThis.indexedDB, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.factory = factory;
    this.timeoutMs = timeoutMs;
  }

  generation(): number {
    return this.epoch;
  }

  isCurrent(generation: number): boolean {
    return generation === this.epoch;
  }

  async read(generation: number): Promise<RememberedVaultKey | null> {
    return this.serialized(async () => {
      if (!this.isCurrent(generation)) return null;
      const value = await this.withDatabase(async (db) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(RECORD_ID);
        return this.completed(transaction, () => request.result as unknown);
      });
      return this.isCurrent(generation) && validRecord(value)
        ? { digest: value.digest, key: value.key }
        : null;
    });
  }

  async save(generation: number, digest: string, key: CryptoKey): Promise<boolean> {
    if (!validDigest(digest) || !isVaultDecryptionKey(key)) return false;
    return this.serialized(async () => {
      if (!this.isCurrent(generation)) return false;
      const saved = await this.withDatabase(async (db) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const existing = store.get(RECORD_ID);
        let permitted = true;
        existing.onsuccess = () => {
          try {
            const value = existing.result as { version?: unknown } | undefined;
            if (value && value.version !== RECORD_VERSION && value.version !== undefined) {
              permitted = false; // Do not overwrite an unknown future schema.
              return;
            }
            if (!this.isCurrent(generation)) return;
            store.put({ version: RECORD_VERSION, digest, key } satisfies StoredKey, RECORD_ID);
          } catch {
            permitted = false;
          }
        };
        await this.completed(transaction, () => undefined);
        return permitted;
      });
      return saved === true && this.isCurrent(generation);
    });
  }

  revoke(): Promise<boolean> {
    this.epoch++; // Invalidates reads and saves even while IndexedDB is pending.
    return this.serialized(async () => {
      const deleted = await this.withDatabase(async (db) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(RECORD_ID);
        await this.completed(transaction, () => undefined);
        return true;
      });
      return deleted === true;
    });
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work, work);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  private async withDatabase<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T | null> {
    const db = await this.open();
    if (!db) return null;
    try {
      return await work(db);
    } catch {
      return null;
    } finally {
      db.close();
    }
  }

  private open(): Promise<IDBDatabase | null> {
    if (!this.factory) return Promise.resolve(null);
    return new Promise((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory!.open(DATABASE_NAME, 1);
      } catch {
        resolve(null);
        return;
      }
      let settled = false;
      const timer = setTimeout(() => finish(null), this.timeoutMs);
      const finish = (db: IDBDatabase | null) => {
        if (settled) {
          db?.close();
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(db);
      };
      request.onupgradeneeded = () => {
        try {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        } catch {
          request.transaction?.abort();
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        finish(request.result);
      };
      request.onerror = () => finish(null);
      // A blocked upgrade remains bounded by the timeout.
    });
  }

  private completed<T>(transaction: IDBTransaction, value: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { transaction.abort(); } catch { /* Already complete or unavailable. */ }
        reject(new Error("IndexedDB transaction timed out"));
      }, this.timeoutMs);
      transaction.oncomplete = () => {
        clearTimeout(timer);
        try { resolve(value()); } catch (error) { reject(error); }
      };
      transaction.onabort = transaction.onerror = () => {
        clearTimeout(timer);
        reject(new Error("IndexedDB transaction failed"));
      };
    });
  }
}

/** Reuse this instance across unlock and lock flows so generations share one queue. */
export const rememberedVaultKeyStorage = new RememberedVaultKeyStorage();
