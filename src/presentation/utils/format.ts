import type {
  CurrencyCode,
  IsoDate,
} from "../../domain/analytics/types.ts";

export const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const countFormatter = new Intl.NumberFormat("es-ES");

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const shortDayFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function euroFromMinor(amountEurMinor: number): number {
  return amountEurMinor / 100;
}

export function formatEuroMinor(amountEurMinor: number): string {
  return euroFormatter.format(euroFromMinor(amountEurMinor));
}

export function formatCurrencyMinor(
  amountMinor: number,
  currency: CurrencyCode,
  fractionDigits: number,
): string {
  const formatterKey = `${currency}:${fractionDigits}`;
  let formatter = currencyFormatters.get(formatterKey);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat("es-ES", {
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
      style: "currency",
    });
    currencyFormatters.set(formatterKey, formatter);
  }
  return formatter.format(amountMinor / 10 ** fractionDigits);
}

export function formatDate(date: IsoDate): string {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function formatPeriodLabel(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) {
    return monthFormatter.format(new Date(`${key}-01T00:00:00Z`)).replace(".", "");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return shortDayFormatter.format(new Date(`${key}T00:00:00Z`)).replace(".", "");
  }
  return key;
}

export function amountTone(
  amountEurMinor: number,
): "positive" | "negative" | "neutral" {
  if (amountEurMinor > 0) return "positive";
  if (amountEurMinor < 0) return "negative";
  return "neutral";
}
