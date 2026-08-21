import type { HTMLAttributes } from "react";

export type AnalyticsPageGridVariant = "kpis" | "main-aside" | "three" | "two";

export interface AnalyticsPageGridProps
  extends HTMLAttributes<HTMLDivElement> {
  readonly variant: AnalyticsPageGridVariant;
}
