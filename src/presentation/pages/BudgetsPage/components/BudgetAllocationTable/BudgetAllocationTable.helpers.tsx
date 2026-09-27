import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";
import type { Tone } from "../../../../components/atoms/Badge/Badge.types.ts";

export const SOURCE_LABELS: Readonly<Record<BudgetAllocationNode["allocationSource"], string>> = {
  EXACT: "Periodo",
  FALLBACK: "Heredada",
  NONE: "Sin base",
  ROLLUP: "Roll-up",
};

export const HEALTH_TONES: Readonly<Record<BudgetAllocationNode["health"], Tone>> = {
  "on-track": "positive",
  watch: "warning",
  exceeded: "negative",
  unallocated: "neutral",
};

export const HEALTH_LABELS: Readonly<Record<BudgetAllocationNode["health"], string>> = {
  "on-track": "En margen",
  watch: "Vigilancia",
  exceeded: "Excedido",
  unallocated: "Sin asignar",
};
