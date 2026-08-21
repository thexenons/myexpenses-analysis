import { createRouter } from "@tanstack/react-router";

import { RoutePending } from "../components/templates/RoutePending/index.ts";
import type { CreateAppRouterOptions } from "./app-router.types.ts";
import { createRouteTree } from "./route-tree.ts";

export function createAppRouter(options: CreateAppRouterOptions = {}) {
  return createRouter({
    basepath: options.basepath ?? import.meta.env.BASE_URL,
    defaultPendingComponent: RoutePending,
    defaultPendingMinMs: 200,
    defaultPendingMs: 150,
    defaultPreload: "intent",
    history: options.history,
    routeTree: createRouteTree(),
    scrollRestoration: true,
  });
}

export const appRouter = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
