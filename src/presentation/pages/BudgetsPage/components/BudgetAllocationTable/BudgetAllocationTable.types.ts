import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";
import type { BudgetPeriodComparison } from "../../../../../domain/analytics/budget-period-comparison.ts";

export interface BudgetAllocationTableProps {
  readonly allocations: readonly BudgetAllocationNode[];
  readonly comparison?: BudgetPeriodComparison | null;
  readonly currency: string;
  readonly fractionDigits: number;
  readonly isFilteredComparison?: boolean;
  readonly onInspectConsumption?: (path: readonly string[], label: string, trigger: HTMLButtonElement) => void;
}
