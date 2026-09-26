import type { AnalyticsDataset, IsoDate } from "./types.ts";

export interface DatasetDateBounds {
  readonly minDate: IsoDate | null;
  readonly maxDate: IsoDate | null;
}

const cache = new WeakMap<AnalyticsDataset, Partial<Record<"operation" | "value", DatasetDateBounds>>>();

/** Dataset snapshots are immutable. The bounds must follow the same date basis as filtering. */
export function datasetDateBounds(
  dataset: AnalyticsDataset,
  dateBasis: "operation" | "value" = "operation",
): DatasetDateBounds {
  let boundsByBasis = cache.get(dataset);
  if (boundsByBasis === undefined) {
    boundsByBasis = {};
    cache.set(dataset, boundsByBasis);
  }
  const existing = boundsByBasis[dateBasis];
  if (existing !== undefined) return existing;
  let minDate: IsoDate | null = null;
  let maxDate: IsoDate | null = null;
  const includedAccounts = new Set(
    dataset.accounts.filter((account) => account.includedInAll !== false).map((account) => account.id),
  );
  for (const posting of dataset.postings) {
    if (!includedAccounts.has(posting.accountId)) continue;
    const date = dateBasis === "value" ? posting.valueDate ?? posting.date : posting.date;
    if (minDate === null || date < minDate) minDate = date;
    if (maxDate === null || date > maxDate) maxDate = date;
  }
  const result = { minDate, maxDate };
  boundsByBasis[dateBasis] = result;
  return result;
}
