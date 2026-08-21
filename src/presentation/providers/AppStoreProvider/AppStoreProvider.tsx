import { AppStoreContext } from "./AppStoreProvider.context.ts";
import type { AppStoreProviderProps } from "./AppStoreProvider.types.ts";

export function AppStoreProvider({
  children,
  store,
}: AppStoreProviderProps) {
  return <AppStoreContext value={store}>{children}</AppStoreContext>;
}
