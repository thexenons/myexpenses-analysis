import { Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

import { AppState } from "../components/templates/AppState/index.ts";
import { AppShell } from "../components/templates/AppShell/index.ts";
import { RoutePending } from "../components/templates/RoutePending/index.ts";
import type { AppViewProps } from "./App.types.ts";

export function AppView({ error, loadPhase, onRetry }: AppViewProps) {
  if (loadPhase === "idle" || loadPhase === "loading") {
    return <AppState state="loading" />;
  }
  if (loadPhase === "error") {
    return (
      <AppState
        message={error ?? "Error desconocido"}
        onRetry={onRetry}
        state="error"
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
