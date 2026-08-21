import { createAppStore } from "../application/store/app-store/app-store.ts";
import { httpDatasetRepository } from "../infrastructure/data/http-dataset-repository.ts";

export const appStore = createAppStore(
  httpDatasetRepository,
  window.localStorage,
);
