import type { LoadPhase } from "../../../../application/store/app-store/app-store.types.ts";

export type UnlockScreenPhase = Exclude<LoadPhase, "ready">;

export interface UnlockScreenProps {
  readonly blockedReason: string | null;
  readonly error: string | null;
  readonly onUnlock: (passphrase: string) => Promise<void>;
  readonly phase: UnlockScreenPhase;
}
