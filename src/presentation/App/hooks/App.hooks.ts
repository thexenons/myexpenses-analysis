import { useEffect } from "react";

import {
  REMEMBERED_LOCK_CHANNEL,
  REMEMBERED_LOCK_MARKER,
  REMEMBERED_LOCK_SENDER,
} from "../../../application/store/app-store/app-store.helpers.ts";
import { useAppStore } from "../../providers/AppStoreProvider/index.ts";
import type { AppViewProps } from "../App.types.ts";

export function useApp(): AppViewProps {
  const error = useAppStore((state) => state.error);
  const notice = useAppStore((state) => state.notice);
  const loadPhase = useAppStore((state) => state.loadPhase);
  const onUnlock = useAppStore((state) => state.actions.unlock);
  const onReloadVault = useAppStore((state) => state.actions.reloadVault);
  const restoreRemembered = useAppStore((state) => state.actions.restoreRemembered);
  const receiveRevocation = useAppStore((state) => state.actions.receiveRevocation);
  const unlockBlockedReason = useAppStore(
    (state) => state.unlockBlockedReason,
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REMEMBERED_LOCK_MARKER && event.newValue !== null) receiveRevocation();
    };
    window.addEventListener("storage", onStorage);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(REMEMBERED_LOCK_CHANNEL);
        channel.onmessage = (event: MessageEvent<unknown>) => {
          const message = event.data as { kind?: unknown; sender?: unknown } | null;
          if (message?.kind === "locked" && message.sender !== REMEMBERED_LOCK_SENDER) receiveRevocation();
        };
      }
    } catch { /* The durable marker and IndexedDB fence remain available. */ }
    void restoreRemembered();
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [receiveRevocation, restoreRemembered]);

  return {
    allowEmptyPassphrase: import.meta.env.DEV,
    error,
    notice,
    loadPhase,
    onUnlock,
    onReloadVault,
    unlockBlockedReason,
  };
}
