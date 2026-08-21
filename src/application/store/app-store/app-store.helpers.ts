import {
  accountMatchesScope,
  restoreFilterState,
} from "../../../domain/analytics/filters.ts";
import type {
  AnalyticsDataset,
  FilterState,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import type { AppStorePersistedState } from "./app-store.types.ts";

export const APP_STORE_STORAGE_NAME = "myexpenses-analysis:ui:v1";
export const APP_STORE_STORAGE_VERSION = 3;

const VALID_GRANULARITIES = new Set<TimeGranularity>([
  "day",
  "week",
  "month",
  "year",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeGranularity(value: unknown): value is TimeGranularity {
  return (
    typeof value === "string" &&
    VALID_GRANULARITIES.has(value as TimeGranularity)
  );
}

export function restoreAppStorePersistedState(
  value: unknown,
): AppStorePersistedState {
  const persisted = isObject(value) ? value : {};
  return {
    filters: restoreFilterState(persisted.filters),
    granularity: isTimeGranularity(persisted.granularity)
      ? persisted.granularity
      : "month",
  };
}

export function reconcileFilterAccounts(
  filters: FilterState,
  analytics: AnalyticsDataset | null,
): FilterState {
  if (analytics === null || filters.accountIds.length === 0) {
    return filters;
  }
  const allowedAccountIds = new Set(
    analytics.accounts
      .filter((account) => accountMatchesScope(account, filters.scope))
      .map((account) => account.id),
  );
  const accountIds = filters.accountIds.filter((accountId) =>
    allowedAccountIds.has(accountId),
  );
  return accountIds.length === filters.accountIds.length
    ? filters
    : { ...filters, accountIds };
}

export function appStoreErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudieron cargar los datos.";
}
