import { createDefaultFilterState, restoreFilterState } from "../../../domain/analytics/filters.ts";
import type { FilterState, TimeGranularitySetting } from "../../../domain/analytics/types.ts";
import type { AppStoreStorage } from "./app-store.types.ts";
import type { SavedFilterPreferences } from "./filter-preferences.ts";

export const FILTER_PRESETS_STORAGE_NAME = "myexpenses-analysis:filter-presets:v1";
const MAX_BYTES = 64 * 1024;
const MAX_PRESETS = 20;
const GRANULARITIES = new Set(["auto", "day", "week", "month", "year"]);
const PRESERVED_DATA_ERROR = "No se pueden utilizar los filtros guardados: formato dañado, no compatible o superior a 64 KiB. Los datos locales se han conservado.";

export interface FilterPreset {
  readonly name: string;
  readonly snapshot: SavedFilterPreferences;
  readonly granularity: TimeGranularitySetting;
}

export interface FilterPresetsState {
  readonly presets: readonly FilterPreset[];
  readonly error: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkedName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || [...trimmed].length > 80) {
    throw new Error("Introduce un nombre de entre 1 y 80 caracteres.");
  }
  return trimmed;
}

function nameKey(name: string): string {
  return name.toLowerCase();
}

/** Presets contain complete v1 snapshots, not a permissively restored partial overlay. */
function checkedSnapshot(value: unknown): SavedFilterPreferences {
  if (!isObject(value) || value.version !== 1 || !isObject(value.filters) ||
    (value.databaseSha256 !== null && (typeof value.databaseSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.databaseSha256)))) {
    throw new Error(PRESERVED_DATA_ERROR);
  }
  const candidate = value.filters;
  const restored = restoreFilterState(candidate);
  for (const field of ["search", "commentSearch", "referenceSearch"] as const) {
    if (typeof candidate[field] !== "string") throw new Error(PRESERVED_DATA_ERROR);

  }
  const complete = { ...restored, search: candidate.search as string, commentSearch: candidate.commentSearch as string, referenceSearch: candidate.referenceSearch as string };
  for (const field of Object.keys(createDefaultFilterState()) as (keyof FilterState)[]) {
    if (JSON.stringify(complete[field]) !== JSON.stringify(candidate[field])) throw new Error(PRESERVED_DATA_ERROR);
  }
  return { version: 1, databaseSha256: value.databaseSha256, filters: complete };
}

function checkedPresets(value: unknown): readonly FilterPreset[] {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.presets) || value.presets.length > MAX_PRESETS) {
    throw new Error(PRESERVED_DATA_ERROR);
  }
  const names = new Set<string>();
  return value.presets.map((candidate: unknown) => {
    if (!isObject(candidate) || typeof candidate.name !== "string" ||
      typeof candidate.granularity !== "string" || !GRANULARITIES.has(candidate.granularity)) throw new Error(PRESERVED_DATA_ERROR);
    const name = checkedName(candidate.name);
    if (name !== candidate.name || names.has(nameKey(name))) throw new Error(PRESERVED_DATA_ERROR);
    names.add(nameKey(name));
    return { name, snapshot: checkedSnapshot(candidate.snapshot), granularity: candidate.granularity as TimeGranularitySetting };
  });
}

export async function readFilterPresets(storage: AppStoreStorage): Promise<FilterPresetsState> {
  let raw: string | null;
  try {
    raw = await storage.getItem(FILTER_PRESETS_STORAGE_NAME);
  } catch {
    return { presets: [], error: "No se pudieron leer los filtros guardados. Comprueba el almacenamiento de este navegador." };
  }
  if (raw === null) return { presets: [], error: null };
  try {
    // Bound parsing, then enforce the aggregate encoded byte limit (not UTF-16 units).
    if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error(PRESERVED_DATA_ERROR);
    return { presets: checkedPresets(JSON.parse(raw)), error: null };
  } catch {
    return { presets: [], error: PRESERVED_DATA_ERROR };
  }
}

async function latestPresets(storage: AppStoreStorage): Promise<readonly FilterPreset[]> {
  const read = await readFilterPresets(storage);
  if (read.error !== null) throw new Error(read.error);
  return read.presets;
}

async function writePresets(storage: AppStoreStorage, presets: readonly FilterPreset[]): Promise<readonly FilterPreset[]> {
  const raw = JSON.stringify({ version: 1, presets });
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error("Los filtros guardados no pueden superar 64 KiB en total.");
  try {
    await storage.setItem(FILTER_PRESETS_STORAGE_NAME, raw);
  } catch {
    throw new Error("No se pudieron guardar los filtros locales. Comprueba el espacio y los permisos de este navegador.");
  }
  return structuredClone(presets);
}

export async function saveFilterPreset(
  storage: AppStoreStorage,
  requestedName: string,
  snapshot: SavedFilterPreferences,
  granularity: TimeGranularitySetting,
  overwrite = false,
): Promise<readonly FilterPreset[]> {
  const name = checkedName(requestedName);
  const presets = await latestPresets(storage);
  const existing = presets.findIndex((preset) => nameKey(preset.name) === nameKey(name));
  if (existing !== -1 && !overwrite) throw new Error("Ya existe un filtro con ese nombre. Utiliza la sobrescritura explícita.");
  if (existing === -1 && overwrite) throw new Error("El filtro que querías sobrescribir ya no existe.");
  if (existing === -1 && presets.length >= MAX_PRESETS) throw new Error("Puedes guardar un máximo de 20 filtros.");
  if (!GRANULARITIES.has(granularity)) throw new Error("La resolución del filtro no es válida.");
  const next = presets.slice();
  const saved = { name: existing === -1 ? name : presets[existing]!.name, snapshot: checkedSnapshot(snapshot), granularity };
  if (existing === -1) next.push(saved);
  else next[existing] = saved;
  return writePresets(storage, next);
}

export async function deleteFilterPreset(storage: AppStoreStorage, name: string): Promise<readonly FilterPreset[]> {
  const presets = await latestPresets(storage);
  if (!presets.some((preset) => preset.name === name)) throw new Error("El filtro guardado ya no existe.");
  return writePresets(storage, presets.filter((preset) => preset.name !== name));
}
