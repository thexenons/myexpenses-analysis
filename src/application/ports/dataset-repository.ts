import type { AppDataset } from "../../domain/analytics/types.ts";

export interface DatasetRepository {
  load(signal?: AbortSignal): Promise<AppDataset>;
}
