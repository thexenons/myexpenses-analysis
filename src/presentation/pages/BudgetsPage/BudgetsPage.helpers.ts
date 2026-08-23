import { analyzeBudgetPeriod } from "../../../domain/analytics/budgets.ts";
import type {
  AnalyticsDataset,
  FilteredAnalyticsDataset,
} from "../../../domain/analytics/types.ts";
import type { BudgetsPageViewProps } from "./BudgetsPage.types.ts";

export function createBudgetsPageModel(
  analytics: AnalyticsDataset,
  filtered: FilteredAnalyticsDataset,
  requestedBudgetUuid: string | null,
  requestedPeriodKey: string | null,
  onBudgetChange: (uuid: string) => void,
  onPeriodChange: (key: string) => void,
  searchPending: boolean,
): BudgetsPageViewProps {
  const budgets = analytics.backup?.budgets ?? [];
  const selectedBudget =
    budgets.find((budget) => budget.uuid === requestedBudgetUuid) ?? budgets[0];
  const budgetOptions = budgets.map((budget) => ({
    value: budget.uuid,
    label: budget.title,
  }));

  if (selectedBudget === undefined) {
    return {
      analysis: null,
      budgetOptions,
      emptyTitle: "No hay presupuestos disponibles",
      emptyDescription:
        "El backup no contiene definiciones de presupuesto que puedan analizarse.",
      onBudgetChange,
      onPeriodChange,
      periodOptions: [],
      searchPending,
      selectedBudgetUuid: "",
      selectedPeriodKey: "",
    };
  }

  const result = analyzeBudgetPeriod(
    analytics,
    filtered,
    selectedBudget,
    requestedPeriodKey ?? undefined,
  );
  if (result.status === "unsupported") {
    return {
      analysis: null,
      budgetOptions,
      emptyTitle: "Presupuesto no representable con seguridad",
      emptyDescription: result.reason,
      onBudgetChange,
      onPeriodChange,
      periodOptions: [],
      searchPending,
      selectedBudgetUuid: selectedBudget.uuid,
      selectedPeriodKey: "",
    };
  }

  return {
    analysis: result.analysis,
    budgetOptions,
    emptyTitle: null,
    emptyDescription: null,
    onBudgetChange,
    onPeriodChange,
    periodOptions: result.analysis.periods.map((period) => ({
      value: period.key,
      label: period.label,
    })),
    searchPending,
    selectedBudgetUuid: selectedBudget.uuid,
    selectedPeriodKey: result.analysis.period.key,
  };
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function budgetAmountFormatter(
  currency: string,
  fractionDigits: number,
): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let formatter = formatterCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat("es-ES", {
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      style: "currency",
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function budgetMinorToMajor(
  amountMinor: number,
  fractionDigits: number,
): number {
  return amountMinor / 10 ** fractionDigits;
}

export function formatBudgetMinor(
  amountMinor: number,
  currency: string,
  fractionDigits: number,
): string {
  return budgetAmountFormatter(currency, fractionDigits).format(
    budgetMinorToMajor(amountMinor, fractionDigits),
  );
}
