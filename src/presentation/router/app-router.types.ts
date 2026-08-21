import type { RouterHistory } from "@tanstack/react-router";

export interface CreateAppRouterOptions {
  readonly basepath?: string;
  readonly history?: RouterHistory;
}
