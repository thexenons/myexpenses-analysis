import type { BudgetAnalysis } from "../../../domain/analytics/budgets.ts";
import type { AnalyticsDataset } from "../../../domain/analytics/types.ts";

export interface BudgetSelectOption {
  readonly value: string;
  readonly label: string;
}

export interface BudgetPeriodSelectOption {
  readonly value: string;
  readonly label: string;
}

export interface BudgetsPageViewProps {
  readonly analysis: BudgetAnalysis | null;
  readonly dataset: AnalyticsDataset;
  readonly budgetOptions: readonly BudgetSelectOption[];
  readonly emptyDescription: string | null;
  readonly emptyTitle: string | null;
  readonly onBudgetChange: (uuid: string) => void;
  readonly onPeriodChange: (key: string) => void;
  readonly periodOptions: readonly BudgetPeriodSelectOption[];
  readonly searchPending: boolean;
  readonly selectedBudgetUuid: string;
  readonly selectedPeriodKey: string;
}
