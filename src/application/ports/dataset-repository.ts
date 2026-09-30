import type { BackupDatasetV1 } from "../../domain/analytics/backup-dataset.types.ts";

export class DatasetTransportError extends Error {
  override readonly name = "DatasetTransportError";
}

export interface DatasetRepository {
  load(passphrase: string, signal?: AbortSignal): Promise<BackupDatasetV1>;
  /** Optional encrypted-vault operations; implementations without a vault remain manual-only. */
  loadForRemembering?(passphrase: string, signal?: AbortSignal): Promise<{
    readonly dataset: BackupDatasetV1;
    readonly digest: string;
    readonly key: CryptoKey;
  }>;
  loadRemembered?(key: CryptoKey, digest: string, signal?: AbortSignal): Promise<BackupDatasetV1 | null>;
  /** Drop only cached encrypted source; the next load fetches it again. */
  invalidateCachedVault?(): void;
}
