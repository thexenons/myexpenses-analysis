import type { LoadPhase } from "../../application/store/app-store/app-store.types.ts";

export interface AppViewProps {
  error: string | null;
  loadPhase: LoadPhase;
  onUnlock: (passphrase: string) => Promise<void>;
  unlockBlockedReason: string | null;
}
