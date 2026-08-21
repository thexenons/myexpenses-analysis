import type {
  AnalyticsDataset,
  FilterState,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";

export type LoadPhase = "idle" | "loading" | "ready" | "error";

export interface AppStoreStorage {
  getItem(name: string): string | null | Promise<string | null>;
  removeItem(name: string): void | Promise<void>;
  setItem(name: string, value: string): void | Promise<void>;
}

export interface AppStoreActions {
  clearFilters(): void;
  closeFilterDrawer(): void;
  initialize(force?: boolean): Promise<void>;
  openFilterDrawer(): void;
  patchFilters(patch: Partial<FilterState>): void;
  setAccountIds(accountIds: readonly string[]): void;
  setCategoryPrefix(categoryPrefix: readonly string[]): void;
  setGranularity(granularity: TimeGranularity): void;
  setStatuses(statuses: FilterState["statuses"]): void;
  setTags(tags: readonly string[]): void;
}

export interface AppStoreState {
  actions: AppStoreActions;
  analytics: AnalyticsDataset | null;
  error: string | null;
  filterDrawerOpen: boolean;
  filters: FilterState;
  granularity: TimeGranularity;
  loadPhase: LoadPhase;
}

export interface AppStorePersistedState {
  readonly filters: FilterState;
  readonly granularity: TimeGranularity;
}
