import { normalizeDataset } from "../../domain/analytics/normalize.ts";
import type { AnalyticsDataset } from "../../domain/analytics/types.ts";
import type { DatasetRepository } from "../ports/dataset-repository.ts";

export interface LoadedAnalytics {
  readonly analytics: AnalyticsDataset;
}

export async function loadAnalytics(
  repository: DatasetRepository,
  signal?: AbortSignal,
): Promise<LoadedAnalytics> {
  const source = await repository.load(signal);
  return {
    analytics: normalizeDataset(source),
  };
}
