import { use } from "react";
import { useStore } from "zustand";

import type { AppStoreState } from "../../../../application/store/app-store/app-store.types.ts";
import { AppStoreContext } from "../AppStoreProvider.context.ts";

export function useAppStore<Selected>(
  selector: (state: AppStoreState) => Selected,
): Selected {
  const store = use(AppStoreContext);
  if (store === null) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return useStore(store, selector);
}
