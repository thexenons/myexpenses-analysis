import type { LoadPhase } from "../../application/store/app-store/app-store.types.ts";

export interface AppViewProps {
  allowEmptyPassphrase: boolean;
  error: string | null;
  notice: string | null;
  loadPhase: LoadPhase;
  onUnlock: (passphrase: string, remember?: boolean) => Promise<void>;
  onReloadVault: () => void;
  unlockBlockedReason: string | null;
}
