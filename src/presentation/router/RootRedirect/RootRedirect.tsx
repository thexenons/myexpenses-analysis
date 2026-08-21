import { Navigate, useLocation } from "@tanstack/react-router";

import { RoutePending } from "../../components/templates/RoutePending/index.ts";

export function RootRedirect() {
  const atRoot = useLocation({ select: (location) => location.pathname === "/" });

  return atRoot ? <Navigate replace to="/resumen" /> : <RoutePending />;
}
