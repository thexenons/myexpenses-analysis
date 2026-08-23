import { useAppStore } from "../../providers/AppStoreProvider/index.ts";
import type { AppViewProps } from "../App.types.ts";

export function useApp(): AppViewProps {
  const error = useAppStore((state) => state.error);
  const loadPhase = useAppStore((state) => state.loadPhase);
  const onUnlock = useAppStore((state) => state.actions.unlock);
  const unlockBlockedReason = useAppStore(
    (state) => state.unlockBlockedReason,
  );

  return {
    allowEmptyPassphrase: import.meta.env.DEV,
    error,
    loadPhase,
    onUnlock,
    unlockBlockedReason,
  };
}
