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
