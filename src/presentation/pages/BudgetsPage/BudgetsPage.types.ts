import type { BudgetAnalysis } from "../../../domain/analytics/budgets.ts";
import type { BudgetPeriodComparison, BudgetReferenceRange } from "../../../domain/analytics/budget-period-comparison.ts";
import type { BudgetPaceResult } from "../../../domain/analytics/budget-pace.ts";
import type { AnnualProjectionResult } from "../../../domain/analytics/annual-projection.ts";
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
  readonly comparison?: BudgetPeriodComparison | null;
  readonly comparisonError?: string | null;
  readonly pace?: BudgetPaceResult | null;
  readonly annualProjection?: AnnualProjectionResult | null;
  readonly annualProjectionError?: "calculation-error" | null;
  readonly dataset: AnalyticsDataset;
  readonly budgetOptions: readonly BudgetSelectOption[];
  readonly emptyDescription: string | null;
  readonly emptyTitle: string | null;
  readonly onBudgetChange: (uuid: string) => void;
  readonly onPeriodChange: (key: string) => void;
  readonly onReferenceAdd?: (range: BudgetReferenceRange) => void;
  readonly onReferenceRemove?: (key: string) => void;
  readonly onPrimaryReferenceChange?: (key: string) => void;
  readonly periodOptions: readonly BudgetPeriodSelectOption[];
  readonly searchPending: boolean;
  readonly selectedBudgetUuid: string;
  readonly selectedPeriodKey: string;
}
