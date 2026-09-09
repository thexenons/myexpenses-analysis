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
  for (const posting of dataset.postings) {
    const date = dateBasis === "value" ? posting.valueDate ?? posting.date : posting.date;
    if (minDate === null || date < minDate) minDate = date;
    if (maxDate === null || date > maxDate) maxDate = date;
  }
  const result = { minDate, maxDate };
  boundsByBasis[dateBasis] = result;
  return result;
}
