import { createAppStore } from "../application/store/app-store/app-store.ts";
import { encryptedHttpDatasetRepository } from "../infrastructure/data/encrypted-http-dataset-repository.ts";
import { createResilientAppStoreStorage } from "../infrastructure/storage/resilient-app-store-storage.ts";
import { rememberedVaultKeyStorage } from "../infrastructure/storage/remembered-vault-key-storage.ts";

export const appStore = createAppStore(
  encryptedHttpDatasetRepository,
  createResilientAppStoreStorage(),
  undefined,
  rememberedVaultKeyStorage,
);
