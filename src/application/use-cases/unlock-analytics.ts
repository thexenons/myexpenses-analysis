import { normalizeBackupDataset } from "../../domain/analytics/normalize-backup-dataset.ts";
import type { AnalyticsDataset } from "../../domain/analytics/types.ts";
import type { DatasetRepository } from "../ports/dataset-repository.ts";

export interface LoadedAnalytics {
  readonly analytics: AnalyticsDataset;
}

export async function unlockAnalytics(
  repository: DatasetRepository,
  passphrase: string,
  signal?: AbortSignal,
): Promise<LoadedAnalytics> {
  const source = await repository.load(passphrase, signal);
  return {
    analytics: normalizeBackupDataset(source),
  };
}
