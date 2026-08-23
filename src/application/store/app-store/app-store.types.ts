import type {
  AnalyticsDataset,
  FilterState,
  TimeGranularity,
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

export interface AppStoreActions {
  clearFilters(): void;
  closeFilterDrawer(): void;
  lock(): void;
  openFilterDrawer(): void;
  patchFilters(patch: Partial<FilterState>): void;
  setAccountIds(accountIds: readonly string[]): void;
  setCategoryPrefix(categoryPrefix: readonly string[]): void;
  setGranularity(granularity: TimeGranularity): void;
  setStatuses(statuses: FilterState["statuses"]): void;
  setTags(tags: readonly string[]): void;
  unlock(passphrase: string): Promise<void>;
}

export interface AppStoreState {
  actions: AppStoreActions;
  analytics: AnalyticsDataset | null;
  error: string | null;
  filterDrawerOpen: boolean;
  filters: FilterState;
  granularity: TimeGranularity;
  loadPhase: LoadPhase;
  unlockBlockedReason: string | null;
}

export interface AppStorePersistedState {
  readonly granularity: TimeGranularity;
}
