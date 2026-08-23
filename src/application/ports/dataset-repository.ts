import type { BackupDatasetV1 } from "../../domain/analytics/backup-dataset.types.ts";

export class DatasetTransportError extends Error {
  override readonly name = "DatasetTransportError";
}

export interface DatasetRepository {
  load(passphrase: string, signal?: AbortSignal): Promise<BackupDatasetV1>;
}
