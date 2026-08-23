import type {
  BudgetPeriodSelectOption,
  BudgetSelectOption,
} from "../../BudgetsPage.types.ts";

export interface BudgetControlsProps {
  readonly budgets: readonly BudgetSelectOption[];
  readonly onBudgetChange: (uuid: string) => void;
  readonly onPeriodChange: (key: string) => void;
  readonly periods: readonly BudgetPeriodSelectOption[];
  readonly selectedBudgetUuid: string;
  readonly selectedPeriodKey: string;
}
