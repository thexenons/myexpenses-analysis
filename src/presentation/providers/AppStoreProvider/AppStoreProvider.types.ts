import type { ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";

import type { AppStoreState } from "../../../application/store/app-store/app-store.types.ts";

export type AppStoreApi = StoreApi<AppStoreState>;

export interface AppStoreProviderProps {
  readonly children: ReactNode;
  readonly store: AppStoreApi;
}
