import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";

export interface BudgetAllocationTableProps {
  readonly allocations: readonly BudgetAllocationNode[];
  readonly currency: string;
  readonly fractionDigits: number;
}
