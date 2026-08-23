import {
  accountMatchesScope,
} from "../../../domain/analytics/filters.ts";
import type {
  AnalyticsDataset,
  FilterState,
  TimeGranularitySetting,
} from "../../../domain/analytics/types.ts";
import type { AppStorePersistedState } from "./app-store.types.ts";
import type { AppStoreEnvironment } from "./app-store.types.ts";

export const APP_STORE_STORAGE_NAME = "myexpenses-analysis:ui:v1";
export const APP_STORE_STORAGE_VERSION = 5;
export const VAULT_UNLOCK_ERROR_MESSAGE =
  "No se pudo abrir la bóveda. Comprueba la frase e inténtalo de nuevo.";
export const VAULT_TRANSPORT_ERROR_MESSAGE =
  "No se pudo descargar la bóveda cifrada. Comprueba la conexión y que el archivo esté publicado.";
export const INSECURE_CONTEXT_MESSAGE =
  "Esta bóveda necesita HTTPS para usar Web Crypto. Ábrela mediante HTTPS o desde localhost.";

const VALID_GRANULARITIES = new Set<TimeGranularitySetting>([
  "auto",
  "day",
  "week",
  "month",
  "year",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeGranularity(value: unknown): value is TimeGranularitySetting {
  return (
    typeof value === "string" &&
    VALID_GRANULARITIES.has(value as TimeGranularitySetting)
  );
}

export function restoreAppStorePersistedState(
  value: unknown,
): AppStorePersistedState {
  const persisted = isObject(value) ? value : {};
  return {
    granularity: isTimeGranularity(persisted.granularity)
      ? persisted.granularity
      : "auto",
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

export function defaultAppStoreEnvironment(): AppStoreEnvironment {
  return {
    hostname: globalThis.location?.hostname ?? "",
    isSecureContext: globalThis.isSecureContext === true,
  };
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export function unlockBlockedReason(
  environment: AppStoreEnvironment,
): string | null {
  return environment.isSecureContext || isLocalHostname(environment.hostname)
    ? null
    : INSECURE_CONTEXT_MESSAGE;
}
