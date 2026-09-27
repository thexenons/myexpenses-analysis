import { Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

import { AppShell } from "../components/templates/AppShell/index.ts";
import { RoutePending } from "../components/templates/RoutePending/index.ts";
import { UnlockScreen } from "../components/templates/UnlockScreen/index.ts";
import type { AppViewProps } from "./App.types.ts";

export function AppView({
  allowEmptyPassphrase,
  error,
  loadPhase,
  onUnlock,
  onReloadVault,
  unlockBlockedReason,
}: AppViewProps) {
  if (loadPhase !== "ready") {
    return (
      <UnlockScreen
        allowEmptyPassphrase={allowEmptyPassphrase}
        blockedReason={unlockBlockedReason}
        error={error}
        onUnlock={onUnlock}
        onReloadVault={onReloadVault}
        phase={loadPhase}
      />
    );
  }
  return (
    <AppShell>
      <Suspense fallback={<RoutePending />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
