import type { FilterPreset } from "./filter-presets.ts";
import type {
  AnalyticsDataset,
  DatePeriodMode,
  DateRangeFilter,
  FilterState,
  TimeGranularitySetting,
} from "../../../domain/analytics/types.ts";

export type LoadPhase = "locked" | "unlocking" | "ready" | "error";

export interface AppStoreEnvironment {
  readonly hostname: string;
  readonly isSecureContext: boolean;
}

export interface AppStoreStorage {
  getItem(name: string): string | null | Promise<string | null>;
  removeItem(name: string): void | Promise<void>;
  setItem(name: string, value: string): void | Promise<void>;
}

export interface RememberedVaultStorage {
  generation(): number;
  isCurrent(generation: number): boolean;
  captureFence(generation: number): Promise<{ readonly token: string | null } | null>;
  read(generation: number): Promise<{
    readonly digest: string;
    readonly key: CryptoKey;
    readonly fence: string | null;
  } | null>;
  save(generation: number, digest: string, key: CryptoKey, fence: string | null): Promise<boolean>;
  revoke(): Promise<boolean>;
}

export interface AppStoreActions {
  saveFilterPreset(name: string, overwrite?: boolean): Promise<boolean>;
  applyFilterPreset(name: string): Promise<boolean>;
  deleteFilterPreset(name: string): Promise<boolean>;
  clearFilters(): void;
  closeFilterDrawer(): void;
  lock(): Promise<boolean>;
  receiveRevocation(): void;
  openFilterDrawer(): void;
  patchFilters(patch: Partial<FilterState>): void;
  reloadVault(): void;
  setDatePeriod(periodMode: DatePeriodMode, dateRange: DateRangeFilter): void;
  setAccountIds(accountIds: readonly string[]): void;
  setCategoryPrefixes(categoryPrefixes: readonly (readonly string[])[]): void;
  setGranularity(granularity: TimeGranularitySetting): void;
  setStatuses(statuses: FilterState["statuses"]): void;
  setTags(tags: readonly string[]): void;
  restoreRemembered(): Promise<void>;
  unlock(passphrase: string, remember?: boolean): Promise<void>;
}

export interface AppStoreState {
  actions: AppStoreActions;
  analytics: AnalyticsDataset | null;
  error: string | null;
  notice: string | null;
  filterPresets: readonly FilterPreset[];
  presetError: string | null;
  presetBusy: boolean;
  filterDrawerOpen: boolean;
  /** In-memory signal for explicit filter resets; never persisted. */
  filterResetRevision: number;
  filters: FilterState;
  granularity: TimeGranularitySetting;
  loadPhase: LoadPhase;
  unlockBlockedReason: string | null;
}

export interface AppStorePersistedState {
  readonly granularity: TimeGranularitySetting;
}
