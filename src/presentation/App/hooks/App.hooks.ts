import { useEffect } from "react";

import { useAppStore } from "../../providers/AppStoreProvider/index.ts";
import type { AppViewProps } from "../App.types.ts";

export function useApp(): AppViewProps {
  const error = useAppStore((state) => state.error);
  const initialize = useAppStore((state) => state.actions.initialize);
  const loadPhase = useAppStore((state) => state.loadPhase);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return {
    error,
    loadPhase,
    onRetry: () => void initialize(true),
  };
}
