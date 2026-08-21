import { createContext } from "react";

import type { AppStoreApi } from "./AppStoreProvider.types.ts";

export const AppStoreContext = createContext<AppStoreApi | null>(null);
