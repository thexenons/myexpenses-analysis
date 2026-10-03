import { describe, expect, it, vi } from "vitest";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import type { AppStoreStorage } from "./app-store.types.ts";
import { deleteFilterPreset, FILTER_PRESETS_STORAGE_NAME, readFilterPresets, saveFilterPreset } from "./filter-presets.ts";

function memoryStorage(raw: string | null = null) {
  const values = new Map<string, string>();
  if (raw !== null) values.set(FILTER_PRESETS_STORAGE_NAME, raw);
  const storage: AppStoreStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: vi.fn<AppStoreStorage["setItem"]>((key, value) => { values.set(key, value); }),
    removeItem: vi.fn<AppStoreStorage["removeItem"]>((key) => { values.delete(key); }),
  };
  return { storage, values };
}
const snapshot = () => ({ version: 1 as const, databaseSha256: null, filters: createDefaultFilterState() });
const preset = (name = "Example") => ({ name, snapshot: snapshot(), granularity: "auto" });

describe("local filter presets", () => {
  it("deep-copies full snapshots and rereads other saved presets before CRUD", async () => {
    const { storage, values } = memoryStorage();
    const saved = snapshot();
    saved.filters = { ...saved.filters, categoryPrefixes: [["Root", "Leaf"]], search: "  Search  ", commentSearch: "Notes", referenceSearch: "Ref", statuses: ["VOID"] };
    const result = await saveFilterPreset(storage, "  Original  ", saved, "week");
    (saved.filters.categoryPrefixes[0] as string[]).push("mutated");
    expect(result[0]).toEqual({ name: "Original", snapshot: { ...saved, filters: { ...saved.filters, categoryPrefixes: [["Root", "Leaf"]] } }, granularity: "week" });
    const other = JSON.parse(values.get(FILTER_PRESETS_STORAGE_NAME)!);
    other.presets.push(preset("Other tab"));
    values.set(FILTER_PRESETS_STORAGE_NAME, JSON.stringify(other));
    await expect(saveFilterPreset(storage, "ORIGINAL", snapshot(), "day")).rejects.toThrow(/existe/);
    expect((await saveFilterPreset(storage, "Original", snapshot(), "day", true)).map((item) => item.name)).toEqual(["Original", "Other tab"]);
    expect((await deleteFilterPreset(storage, "Original")).map((item) => item.name)).toEqual(["Other tab"]);
    expect((await readFilterPresets(storage)).error).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each([
    "{", JSON.stringify({ version: 2, presets: [] }),
    JSON.stringify({ version: 1, presets: [preset(), preset("EXAMPLE")] }),
    JSON.stringify({ version: 1, presets: [{ ...preset(), snapshot: { ...snapshot(), filters: { scope: "all" } } }] }),
    JSON.stringify({ version: 1, presets: [{ ...preset(), granularity: "unknown" }] }),
    JSON.stringify({ version: 1, presets: [{ ...preset(), snapshot: { ...snapshot(), filters: { ...createDefaultFilterState(), minAmountEurMinor: 0.5 } } }] }),
    JSON.stringify({ version: 1, presets: Array.from({ length: 21 }, (_, index) => preset(`Preset ${index}`)) }),
    " ".repeat(65537),
    JSON.stringify({ version: 1, presets: [{ ...preset(), snapshot: { ...snapshot(), filters: { ...createDefaultFilterState(), search: "é".repeat(33000) } } }] }),
  ])("refuses malformed, future or oversized storage without clobbering it (%#)", async (raw) => {
    const { storage, values } = memoryStorage(raw);
    expect((await readFilterPresets(storage)).error).not.toBeNull();
    await expect(saveFilterPreset(storage, "New", snapshot(), "auto")).rejects.toThrow(/No se pueden utilizar/);
    await expect(deleteFilterPreset(storage, "Example")).rejects.toThrow(/No se pueden utilizar/);
    expect(values.get(FILTER_PRESETS_STORAGE_NAME)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("bounds trimmed names, count and serialized aggregate UTF-8 bytes", async () => {
    const { storage, values } = memoryStorage(JSON.stringify({ version: 1, presets: Array.from({ length: 19 }, (_, index) => preset(`Preset ${index}`)) }));
    await saveFilterPreset(storage, "x".repeat(80), snapshot(), "year");
    const previous = values.get(FILTER_PRESETS_STORAGE_NAME);
    await expect(saveFilterPreset(storage, "Twenty one", snapshot(), "auto")).rejects.toThrow(/20/);
    await expect(saveFilterPreset(storage, " ", snapshot(), "auto")).rejects.toThrow(/nombre/);
    await expect(saveFilterPreset(storage, "x".repeat(81), snapshot(), "auto")).rejects.toThrow(/80/);
    const huge = snapshot();
    huge.filters = { ...huge.filters, commentSearch: "é".repeat(33000) };
    await expect(saveFilterPreset(storage, "Preset 0", huge, "auto", true)).rejects.toThrow(/64/);
    expect(values.get(FILTER_PRESETS_STORAGE_NAME)).toBe(previous);
  });

  it("reports synchronous and asynchronous storage failures without pretending success", async () => {
    const { storage, values } = memoryStorage();
    storage.getItem = () => { throw new Error("sensitive backend detail"); };
    expect((await readFilterPresets(storage)).error).not.toContain("sensitive");
    await expect(saveFilterPreset(storage, "New", snapshot(), "auto")).rejects.toThrow(/leer/);
    storage.getItem = async () => null;
    storage.setItem = async () => { throw new Error("quota"); };
    await expect(saveFilterPreset(storage, "New", snapshot(), "auto")).rejects.toThrow(/guardar/);
    expect(values.size).toBe(0);
  });
});


it("accepts exactly 64 KiB encoded payloads and rejects the next byte without writing", async () => {
  const { storage, values } = memoryStorage();
  const saved = snapshot();
  const overhead = new TextEncoder().encode(JSON.stringify({ version: 1, presets: [{ name: "Boundary", snapshot: saved, granularity: "auto" }] })).byteLength;
  saved.filters = { ...saved.filters, search: "a".repeat(65536 - overhead) };
  await saveFilterPreset(storage, "Boundary", saved, "auto");
  const raw = values.get(FILTER_PRESETS_STORAGE_NAME)!;
  expect(new TextEncoder().encode(raw).byteLength).toBe(65536);
  expect((await readFilterPresets(storage)).error).toBeNull();
  saved.filters = { ...saved.filters, search: `${saved.filters.search}a` };
  await expect(saveFilterPreset(storage, "Boundary", saved, "auto", true)).rejects.toThrow(/64/);
  expect(values.get(FILTER_PRESETS_STORAGE_NAME)).toBe(raw);
});
