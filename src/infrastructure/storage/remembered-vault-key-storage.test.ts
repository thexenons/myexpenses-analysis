import { describe, expect, it, vi } from "vitest";

import { RememberedVaultKeyStorage } from "./remembered-vault-key-storage.ts";

const digest = "a".repeat(64);

function fakeDatabase() {
  const records = new Map<string, unknown>();
  let failOpen = false;
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => undefined,
    transaction: () => {
      const transaction: Record<string, unknown> = { oncomplete: null, onerror: null, onabort: null };
      let pending = 0;
      function request(result: () => unknown) {
        const entry: Record<string, unknown> = { result: undefined, onsuccess: null, onerror: null };
        pending++;
        queueMicrotask(() => {
          entry.result = result();
          (entry.onsuccess as (() => void) | null)?.();
          pending--;
          queueMicrotask(() => {
            if (pending === 0) (transaction.oncomplete as (() => void) | null)?.();
          });
        });
        return entry;
      }
      transaction.objectStore = () => ({
        get: (key: string) => request(() => records.get(key)),
        put: (value: unknown, key: string) => request(() => { records.set(key, value); }),
        delete: (key: string) => request(() => { records.delete(key); }),
      });
      transaction.abort = () => (transaction.onabort as (() => void) | null)?.();
      return transaction;
    },
  };
  const factory = {
    open: () => {
      if (failOpen) throw new Error("storage unavailable");
      const operation: Record<string, unknown> = { result: database, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => (operation.onsuccess as (() => void) | null)?.());
      return operation;
    },
  } as unknown as IDBFactory;
  return { records, factory, setFailOpen: (value: boolean) => { failOpen = value; } };
}

async function decryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new Uint8Array(32), "AES-GCM", false, ["decrypt"]);
}

describe("remembered vault key storage", () => {
  it("does not read a blocked IndexedDB getter while constructing the app", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get: () => { throw new DOMException("Blocked IndexedDB", "SecurityError"); },
    });
    try {
      const storage = new RememberedVaultKeyStorage();
      expect(await storage.read(storage.generation())).toBeNull();
      expect(await storage.revoke()).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
      else Reflect.deleteProperty(globalThis, "indexedDB");
    }
  });

  it("stores one decrypt-only key and exact digest, then revokes it", async () => {
    const fake = fakeDatabase();
    const storage = new RememberedVaultKeyStorage(fake.factory);
    const generation = storage.generation();
    const storedKey = await decryptionKey();
    expect(await storage.save(generation, digest, storedKey)).toBe(true);
    expect(await storage.read(generation)).toEqual({ digest, key: storedKey, fence: null });
    expect(fake.records.size).toBe(1);
    expect(await storage.revoke()).toBe(true);
    expect(await storage.read(storage.generation())).toBeNull();
  });

  it("invalidates pending writes before revocation and never returns a stale read", async () => {
    const fake = fakeDatabase();
    const storage = new RememberedVaultKeyStorage(fake.factory);
    const generation = storage.generation();
    const saving = storage.save(generation, digest, await decryptionKey());
    const revoking = storage.revoke();
    expect(await saving).toBe(false);
    expect(await revoking).toBe(true);
    expect(await storage.read(generation)).toBeNull();
    expect(fake.records.size).toBe(1);
    expect(fake.records.get("current")).not.toHaveProperty("key");
  });

  it("rejects invalid/future records and leaves future records untouched", async () => {
    const fake = fakeDatabase();
    const storage = new RememberedVaultKeyStorage(fake.factory);
    fake.records.set("current", { version: 3, digest, key: await decryptionKey() });
    expect(await storage.read(storage.generation())).toBeNull();
    expect(await storage.save(storage.generation(), digest, await decryptionKey())).toBe(false);
    expect((fake.records.get("current") as { version: number }).version).toBe(3);
    fake.records.set("current", { version: 1, digest, key: "not a key" });
    expect(await storage.read(storage.generation())).toBeNull();
    fake.records.set("current", {
      version: 1,
      digest,
      key: { type: "secret", algorithm: { name: "AES-GCM", length: 256 }, extractable: false, usages: ["decrypt"] },
    });
    expect(await storage.read(storage.generation())).toBeNull();
  });

  it("contains blocked or unavailable storage without allowing false remembered success", async () => {
    const fake = fakeDatabase();
    fake.setFailOpen(true);
    const storage = new RememberedVaultKeyStorage(fake.factory);
    expect(await storage.read(storage.generation())).toBeNull();
    expect(await storage.save(storage.generation(), digest, await decryptionKey())).toBe(false);
    expect(await storage.revoke()).toBe(false);
  });

  it("fences a pending save from another tab after a completed revocation", async () => {
    const fake = fakeDatabase();
    const firstTab = new RememberedVaultKeyStorage(fake.factory);
    const secondTab = new RememberedVaultKeyStorage(fake.factory);
    const staleFence = await secondTab.captureFence(secondTab.generation());
    expect(staleFence).toEqual({ token: null });
    expect(await firstTab.revoke()).toBe(true);
    expect(await secondTab.save(secondTab.generation(), digest, await decryptionKey(), staleFence!.token)).toBe(false);
    expect(await firstTab.read(firstTab.generation())).toBeNull();
    expect(await secondTab.captureFence(secondTab.generation())).not.toEqual(staleFence);
  });

  it("bounds a stalled open and closes a database that arrives after timeout", async () => {
    const close = vi.fn<() => void>();
    const opening: Record<string, unknown> = {
      result: { close, objectStoreNames: { contains: () => true } },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    const factory = { open: () => opening } as unknown as IDBFactory;
    const storage = new RememberedVaultKeyStorage(factory, 5);
    expect(await storage.read(storage.generation())).toBeNull();
    (opening.onsuccess as (() => void) | null)?.();
    expect(close).toHaveBeenCalledOnce();
  });
});
