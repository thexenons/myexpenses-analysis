import { analyzeBudgetPeriod } from "../../../domain/analytics/budgets.ts";
import type { BudgetPaceAmount, BudgetPaceBasis, BudgetPaceUnavailableReason } from "../../../domain/analytics/budget-pace.ts";
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
      dataset: analytics,
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
      dataset: analytics,
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
    dataset: analytics,
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
      signDisplay: "negative",
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

export function formatPaceDifference(amount: Extract<BudgetPaceAmount, { status: "ready" }>, currency: string, fractionDigits: number): string {
  const difference = amount.differenceMinor;
  if (Math.abs(difference) < 0.5) return "igual a la referencia";
  return `${formatBudgetMinor(Math.abs(difference), currency, fractionDigits)} ${difference > 0 ? "por debajo" : "por encima"} de la referencia`;
}

export function paceUnavailableLabel(reason: BudgetPaceUnavailableReason): string {
  if (reason === "filtered-comparison") return "Referencia lineal no disponible: el corte no cubre desde el inicio hasta hoy o incluye filtros de subconjunto.";
  if (reason === "future-period") return "Referencia lineal no disponible: el periodo aún no ha comenzado.";
  return "Referencia lineal no disponible: este periodo no tiene una unidad mensual o anual comparable.";
}

export function paceBasisLabel(basis: BudgetPaceBasis): string {
  if (basis.grouping === "MONTH") return `${basis.elapsedUnits} días de ${basis.totalUnits} días, contando el día de corte.`;
  const month = Number(basis.cutoffDate.slice(5, 7));
  const year = Number(basis.cutoffDate.slice(0, 4));
  const day = Number(basis.cutoffDate.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${month - 1} meses completos más ${day}/${daysInMonth} de ${monthLabel}, sobre 12 meses.`;
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

const comparisonPercentFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export function formatBudgetComparisonDelta(
  deltaMinor: number | null,
  percentChange: number | null,
  currency: string,
  fractionDigits: number,
): string {
  if (deltaMinor === null) return "Sin diferencia disponible";
  const amount = `${deltaMinor > 0 ? "+" : ""}${formatBudgetMinor(deltaMinor, currency, fractionDigits)}`;
  return `${amount} · ${percentChange === null ? "sin porcentaje (base cero)" : `${comparisonPercentFormatter.format(percentChange)} %`}`;
}
