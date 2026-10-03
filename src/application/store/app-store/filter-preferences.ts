import { accountMatchesScope, restoreFilterState } from "../../../domain/analytics/filters.ts";
import { payeeIdentityKey, paymentMethodIdentityKey } from "../../../domain/analytics/identity-keys.ts";
import type { AnalyticsDataset, FilterState } from "../../../domain/analytics/types.ts";
import type { AppStoreStorage } from "./app-store.types.ts";

export const FILTER_PREFERENCES_STORAGE_NAME = "myexpenses-analysis:filters:v1";
const FILTER_PREFERENCES_VERSION = 1;
const MAX_PREFERENCE_LENGTH = 64 * 1024;
const MAX_SELECTED_VALUES = 100;

interface SavedFilterPreferences {
  readonly version: 1;
  readonly databaseSha256: string | null;
  readonly filters: FilterState;
}

export type ReadFilterPreferences =
  | { readonly kind: "absent" | "future" }
  | { readonly kind: "saved"; readonly value: SavedFilterPreferences };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function databaseHash(analytics: AnalyticsDataset): string | null {
  const hash = analytics.backup?.source.databaseSha256;
  return typeof hash === "string" && /^[a-f0-9]{64}$/i.test(hash) ? hash : null;
}

function exceedsSelectionLimit(filters: FilterState): boolean {
  return [
    filters.accountIds,
    filters.originAccountIds ?? [],
    filters.destinationAccountIds ?? [],
    filters.categoryPrefixes,
    filters.tags,
    filters.payeeKeys ?? [],
    filters.paymentMethodKeys ?? [],
    filters.currencies ?? [],
  ].some((selection) => selection.length > MAX_SELECTED_VALUES);
}

function savedFilterFields(filters: FilterState): FilterState {
  return {
    scope: filters.scope,
    periodMode: filters.periodMode,
    dateRange: { ...filters.dateRange },
    accountIds: filters.accountIds.slice(),
    originAccountIds: filters.originAccountIds?.slice() ?? [],
    destinationAccountIds: filters.destinationAccountIds?.slice() ?? [],
    dateBasis: filters.dateBasis,
    categoryMatch: filters.categoryMatch,
    categoryDepth: filters.categoryDepth,
    categoryMode: filters.categoryMode ?? "include",
    categoryPrefixes: filters.categoryPrefixes.map((path) => path.slice()),
    statuses: [],
    tags: filters.tags.slice(),
    search: filters.search,
    linked: filters.linked,
    payeeKeys: filters.payeeKeys?.slice() ?? [],
    paymentMethodKeys: filters.paymentMethodKeys?.slice() ?? [],
    categoryTypes: filters.categoryTypes ?? [],
    currencies: filters.currencies?.slice() ?? [],
    minAmountEurMinor: filters.minAmountEurMinor ?? null,
    maxAmountEurMinor: filters.maxAmountEurMinor ?? null,
    commentSearch: filters.commentSearch ?? "",
    referenceSearch: filters.referenceSearch ?? "",
  };
}

export async function readFilterPreferences(storage: AppStoreStorage): Promise<ReadFilterPreferences> {
  try {
    const raw = await storage.getItem(FILTER_PREFERENCES_STORAGE_NAME);
    if (raw === null) return { kind: "absent" };
    // Do not parse oversized input or erase a version written by a newer client.
    if (raw.length > MAX_PREFERENCE_LENGTH) return { kind: "future" };
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return { kind: "absent" };
    if (typeof parsed.version === "number" && parsed.version > FILTER_PREFERENCES_VERSION) return { kind: "future" };
    if (parsed.version !== FILTER_PREFERENCES_VERSION || !isObject(parsed.filters)) return { kind: "absent" };
    const candidate = parsed.filters;
    if (!isObject(candidate.dateRange) || typeof candidate.scope !== "string" ||
      typeof candidate.periodMode !== "string") return { kind: "absent" };
    const filters = restoreFilterState({ ...candidate, statuses: [] });
    if (filters.scope !== candidate.scope || filters.periodMode !== candidate.periodMode) return { kind: "absent" };
    if (exceedsSelectionLimit(filters)) return { kind: "absent" };
    const malformedDate = isObject(candidate.dateRange) && (
      (candidate.dateRange.from !== null && candidate.dateRange.from !== undefined && filters.dateRange.from === null) ||
      (candidate.dateRange.to !== null && candidate.dateRange.to !== undefined && filters.dateRange.to === null)
    );
    return {
      kind: "saved",
      value: {
        version: 1,
        databaseSha256: typeof parsed.databaseSha256 === "string" && /^[a-f0-9]{64}$/i.test(parsed.databaseSha256)
          ? parsed.databaseSha256 : null,
        filters: savedFilterFields(malformedDate
          ? { ...filters, periodMode: "all", dateRange: { from: null, to: null } }
          : filters),
      },
    };
  } catch {
    return { kind: "absent" };
  }
}

export function saveFilterPreferences(storage: AppStoreStorage, filters: FilterState, analytics: AnalyticsDataset): void {
  try {
    if (exceedsSelectionLimit(filters)) {
      void Promise.resolve(storage.removeItem(FILTER_PREFERENCES_STORAGE_NAME)).catch(() => undefined);
      return;
    }
    const value: SavedFilterPreferences = {
      version: FILTER_PREFERENCES_VERSION,
      databaseSha256: databaseHash(analytics),
      filters: savedFilterFields(filters),
    };
    const raw = JSON.stringify(value);
    if (raw.length > MAX_PREFERENCE_LENGTH) {
      void Promise.resolve(storage.removeItem(FILTER_PREFERENCES_STORAGE_NAME)).catch(() => undefined);
      return;
    }
    void Promise.resolve(storage.setItem(FILTER_PREFERENCES_STORAGE_NAME, raw)).catch(() => undefined);
  } catch {
    // Storage failure must not interrupt filters or unlock.
  }
}

function isNumericIdentityKey(key: string): boolean {
  const parsed: unknown = JSON.parse(key);
  return Array.isArray(parsed) && parsed[0] === "source";
}

/** Reconcile against the full loaded dataset, never options narrowed by another filter. */
export function reconcileSavedFilters(saved: SavedFilterPreferences, analytics: AnalyticsDataset): FilterState {
  const filters = saved.filters;
  const accountIds = new Set(analytics.accounts.filter((account) => accountMatchesScope(account, filters.scope)).map((account) => account.id));
  const endpointIds = new Set(analytics.accounts.filter((account) => accountMatchesScope(account, "all")).map((account) => account.id));
  const categoryPaths = new Set<string>();
  const tags = new Set<string>();
  const currencies = new Set<string>();
  const payees = new Set<string>();
  const methods = new Set<string>();
  for (const posting of analytics.postings) {
    if (posting.isVoid) continue;
    if (posting.categoryPath.length === 0) categoryPaths.add("[]");
    for (let length = 1; length <= posting.categoryPath.length; length += 1) {
      categoryPaths.add(JSON.stringify(posting.categoryPath.slice(0, length)));
    }
    for (const tag of posting.tags) tags.add(tag);
    currencies.add(posting.currency);
    payees.add(payeeIdentityKey(posting));
    methods.add(paymentMethodIdentityKey(posting));
  }
  const trustedDatabase = saved.databaseSha256 !== null && saved.databaseSha256 === databaseHash(analytics);
  const availableIdentity = (keys: readonly string[], available: ReadonlySet<string>) =>
    keys.filter((key) => available.has(key) && (!isNumericIdentityKey(key) || trustedDatabase));
  return {
    ...filters,
    accountIds: filters.accountIds.filter((id) => accountIds.has(id)),
    originAccountIds: (filters.originAccountIds ?? []).filter((id) => endpointIds.has(id)),
    destinationAccountIds: (filters.destinationAccountIds ?? []).filter((id) => endpointIds.has(id)),
    categoryPrefixes: filters.categoryPrefixes.filter((path) => categoryPaths.has(JSON.stringify(path))),
    statuses: [],
    tags: filters.tags.filter((tag) => tags.has(tag)),
    payeeKeys: availableIdentity(filters.payeeKeys ?? [], payees),
    paymentMethodKeys: availableIdentity(filters.paymentMethodKeys ?? [], methods),
    currencies: (filters.currencies ?? []).filter((currency) => currencies.has(currency)),
  };
}
