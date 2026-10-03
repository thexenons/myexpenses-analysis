import { describe, expect, it, vi } from "vitest";

import { createResilientAppStoreStorage } from "./resilient-app-store-storage.ts";

describe("createResilientAppStoreStorage", () => {
  it("falls back to session memory when the localStorage getter throws", () => {
    const storage = createResilientAppStoreStorage(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(() => storage.setItem("preferences", "week")).not.toThrow();
    expect(storage.getItem("preferences")).toBe("week");
    expect(() => storage.removeItem("preferences")).not.toThrow();
    expect(storage.getItem("preferences")).toBeNull();
  });

  it("retains a fallback when browser writes fail from quota", () => {
    const browserStorage = {
      getItem: vi.fn<(name: string) => string | null>(() => "stale-value"),
      removeItem: vi.fn<(name: string) => void>(() => {
        throw new DOMException("Blocked", "SecurityError");
      }),
      setItem: vi.fn<(name: string, value: string) => void>(() => {
        throw new DOMException("Quota", "QuotaExceededError");
      }),
    };
    const storage = createResilientAppStoreStorage(() => browserStorage);

    storage.setItem("preferences", "month");

    expect(storage.getItem("preferences")).toBe("month");
    expect(browserStorage.setItem).toHaveBeenCalledWith("preferences", "month");
    storage.removeItem("preferences");
    expect(storage.getItem("preferences")).toBeNull();
    expect(browserStorage.removeItem).toHaveBeenCalledWith("preferences");
  });
});

it("uses durable latest bytes for preset keys without an overlay or swallowed failures", () => {
  const key = "myexpenses-analysis:filter-presets:v1";
  const browser = new Map<string, string>();
  const adapter = createResilientAppStoreStorage(() => ({
    getItem: (name) => browser.get(name) ?? null,
    setItem: (name, value) => { browser.set(name, value); },
    removeItem: (name) => { browser.delete(name); },
  }));
  adapter.setItem(key, "first");
  browser.set(key, "newer malformed bytes");
  expect(adapter.getItem(key)).toBe("newer malformed bytes");
  adapter.removeItem(key);
  expect(browser.has(key)).toBe(false);
  const blocked = createResilientAppStoreStorage(() => { throw new DOMException("Blocked", "SecurityError"); });
  expect(() => blocked.getItem(key)).toThrow(/Blocked/);
  expect(() => blocked.setItem(key, "not durable")).toThrow(/Blocked/);
  expect(() => blocked.removeItem(key)).toThrow(/Blocked/);
  expect(() => blocked.setItem("preferences", "month")).not.toThrow();
  expect(blocked.getItem("preferences")).toBe("month");
});

it("does not mask a failed preset write with a successful session-only copy", () => {
  const key = "myexpenses-analysis:filter-presets:v1";
  const adapter = createResilientAppStoreStorage(() => ({
    getItem: () => "original",
    setItem: () => { throw new DOMException("Quota", "QuotaExceededError"); },
    removeItem: () => { throw new DOMException("Blocked", "SecurityError"); },
  }));
  expect(() => adapter.setItem(key, "replacement")).toThrow(/Quota/);
  expect(adapter.getItem(key)).toBe("original");
});
