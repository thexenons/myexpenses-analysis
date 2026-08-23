import type { BudgetHealth } from "../../../../../domain/analytics/budgets.ts";

export interface BudgetUtilizationProps {
  readonly health: BudgetHealth;
  readonly label: string;
  readonly utilization: number | null;
  readonly variant?: "compact" | "hero";
}
