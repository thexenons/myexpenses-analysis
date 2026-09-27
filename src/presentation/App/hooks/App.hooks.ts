import { useAppStore } from "../../providers/AppStoreProvider/index.ts";
import type { AppViewProps } from "../App.types.ts";

export function useApp(): AppViewProps {
  const error = useAppStore((state) => state.error);
  const loadPhase = useAppStore((state) => state.loadPhase);
  const onUnlock = useAppStore((state) => state.actions.unlock);
  const onReloadVault = useAppStore((state) => state.actions.reloadVault);
  const unlockBlockedReason = useAppStore(
    (state) => state.unlockBlockedReason,
  );

  return {
    allowEmptyPassphrase: import.meta.env.DEV,
    error,
    loadPhase,
    onUnlock,
    onReloadVault,
    unlockBlockedReason,
  };
}
