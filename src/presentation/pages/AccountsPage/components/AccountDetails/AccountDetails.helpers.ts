import type {
  AccountRegistryEntry,
  NormalizedAccount,
} from "../../../../../domain/analytics/types.ts";

const exchangeRateFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 8,
});

const exchangeModeLabels = {
  DYNAMIC: "Dinámica",
  IDENTITY: "Identidad EUR",
  STATIC: "Estática",
} as const;

export function resolveAccountExchangeRate(
  account: NormalizedAccount,
  registryEntry: AccountRegistryEntry | undefined,
): number | null {
  if (account.exchangeRateMode === "IDENTITY") {
    return 1;
  }
  if (account.exchangeRateMode === "STATIC") {
    return registryEntry?.exchangeRateToEur ?? null;
  }
  if (account.currentBalanceNativeMinor === 0) {
    return null;
  }
  return Math.abs(
    account.valuationBalanceEurMinor / account.currentBalanceNativeMinor,
  );
}

export function exchangeModeLabel(
  mode: NormalizedAccount["exchangeRateMode"],
): string {
  return `${exchangeModeLabels[mode]} (${mode})`;
}

export function formatAccountExchangeRate(
  currency: NormalizedAccount["currency"],
  exchangeRateToEur: number | null,
): string {
  return exchangeRateToEur === null
    ? "No disponible con saldo nativo cero"
    : `1 ${currency} = ${exchangeRateFormatter.format(exchangeRateToEur)} EUR`;
}
