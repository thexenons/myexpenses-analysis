import { Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

import { AppShell } from "../components/templates/AppShell/index.ts";
import { RoutePending } from "../components/templates/RoutePending/index.ts";
import { UnlockScreen } from "../components/templates/UnlockScreen/index.ts";
import type { AppViewProps } from "./App.types.ts";

export function AppView({
  error,
  loadPhase,
  onUnlock,
  unlockBlockedReason,
}: AppViewProps) {
  if (loadPhase !== "ready") {
    return (
      <UnlockScreen
        blockedReason={unlockBlockedReason}
        error={error}
        onUnlock={onUnlock}
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
