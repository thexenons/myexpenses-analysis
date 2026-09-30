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

export async function unlockAnalyticsForRemembering(
  repository: DatasetRepository,
  passphrase: string,
  signal?: AbortSignal,
): Promise<LoadedAnalytics & { readonly digest: string; readonly key: CryptoKey }> {
  if (!repository.loadForRemembering) throw new Error("Remembered unlock is unavailable");
  const { dataset, digest, key } = await repository.loadForRemembering(passphrase, signal);
  return { analytics: normalizeBackupDataset(dataset), digest, key };
}

export async function unlockRememberedAnalytics(
  repository: DatasetRepository,
  key: CryptoKey,
  digest: string,
  signal?: AbortSignal,
): Promise<LoadedAnalytics | null> {
  if (!repository.loadRemembered) return null;
  const source = await repository.loadRemembered(key, digest, signal);
  return source === null ? null : { analytics: normalizeBackupDataset(source) };
}
