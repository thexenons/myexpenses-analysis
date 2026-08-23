import type {
  CategoryType,
  ExchangeRateSource,
  NormalizedPosting,
  PostingBucket,
} from "../../../../../domain/analytics/types.ts";

const categoryTypeLabels: Readonly<Record<CategoryType, string>> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  NEUTRAL: "Neutral",
  TRANSFER: "Transferencia",
};

const bucketLabels: Readonly<Record<PostingBucket, string>> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
};

const exchangeRateSourceLabels: Readonly<Record<ExchangeRateSource, string>> = {
  "dynamic-equivalent": "Equivalente dinámico",
  "dynamic-rate": "Tasa dinámica",
  identity: "Identidad EUR",
  static: "Tasa estática",
};

const exchangeRateFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 8,
});

const reconciliationStatusLabels = {
  CLEARED: "Compensada",
  RECONCILED: "Conciliada",
  UNRECONCILED: "Sin conciliar",
  VOID: "Anulada",
} as const;

export function formatExchangeRate(posting: NormalizedPosting): string {
  return `1 ${posting.currency} = ${exchangeRateFormatter.format(posting.exchangeRateToEur)} EUR`;
}

export function formatSplit(posting: NormalizedPosting): string {
  return posting.splitIndex === null || posting.splitCount === null
    ? "Movimiento directo"
    : `Parte ${posting.splitIndex + 1} de ${posting.splitCount}`;
}

export function parentTransactionId(posting: NormalizedPosting): string {
  return posting.splitIndex === null ? "No aplica" : posting.sourceTransactionId;
}

export function categoryTypeLabel(categoryType: CategoryType): string {
  return `${categoryTypeLabels[categoryType]} (${categoryType})`;
}

export function bucketLabel(bucket: PostingBucket): string {
  return `${bucketLabels[bucket]} (${bucket})`;
}

export function exchangeRateSourceLabel(
  source: ExchangeRateSource,
): string {
  return `${exchangeRateSourceLabels[source]} (${source})`;
}

export function linkedAccountLabel(posting: NormalizedPosting): string {
  return posting.linked
    ? `Sí${posting.transferAccount ? ` · ${posting.transferAccount}` : ""}`
    : "No";
}

export function reconciliationStatusLabel(
  posting: NormalizedPosting,
): string {
  const status = posting.backupStatus ?? posting.status;
  return `${reconciliationStatusLabels[status]} (${status})`;
}
