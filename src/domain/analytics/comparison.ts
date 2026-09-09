import { aggregateDebtBreakdown, aggregateKpis } from "./aggregations.ts";
import { datasetDateBounds } from "./date-bounds.ts";
import { applyFilters } from "./filters.ts";
import { addIsoDays, monthPeriodForDate } from "./periods.ts";
import { assertIsoDate } from "./validation.ts";
import type { FilteredAnalyticsDataset, IsoDate } from "./types.ts";

export type ComparisonMode = "none" | "previousPeriod" | "previousYear" | "custom";

export interface ComparisonDateRange {
  readonly from: IsoDate;
  readonly to: IsoDate;
}

export interface PeriodComparisonOptions {
  readonly mode: ComparisonMode;
  readonly dateRange?: ComparisonDateRange;
}

export interface PeriodComparisonMetric {
  readonly key: string;
  readonly label: string;
  readonly currentEurMinor: number;
  readonly referenceEurMinor: number;
  readonly deltaEurMinor: number;
  /** Percentage of the absolute reference; null when the reference is zero. */
  readonly deltaPercent: number | null;
}

export interface PeriodComparisonResult {
  readonly currentRange: ComparisonDateRange;
  readonly referenceRange: ComparisonDateRange;
  readonly currentPostingCount: number;
  readonly referencePostingCount: number;
  readonly referenceOutsideHistory: boolean;
  readonly metrics: readonly PeriodComparisonMetric[];
}

function datasetDateRange(filtered: FilteredAnalyticsDataset): ComparisonDateRange | null {
  const { minDate, maxDate } = datasetDateBounds(filtered.source, filtered.filters.dateBasis);
  return minDate === null || maxDate === null ? null : { from: minDate, to: maxDate };
}

export function comparisonCurrentRange(
  filtered: FilteredAnalyticsDataset,
): ComparisonDateRange | null {
  const observed = datasetDateRange(filtered);
  const from = filtered.filters.dateRange.from ?? observed?.from;
  const to = filtered.filters.dateRange.to ?? observed?.to;
  return from === undefined || to === undefined || from > to ? null : { from, to };
}

function previousYearDate(date: IsoDate): IsoDate {
  const year = Number(date.slice(0, 4)) - 1;
  if (year < 1) throw new Error("No hay un año anterior válido para comparar.");
  const prefix = `${String(year).padStart(4, "0")}${date.slice(4, 8)}`;
  if (date.endsWith("-02-29")) return `${prefix}28` as IsoDate;
  return `${String(year).padStart(4, "0")}${date.slice(4)}` as IsoDate;
}

function referenceDateRange(
  filtered: FilteredAnalyticsDataset,
  current: ComparisonDateRange,
  options: PeriodComparisonOptions,
): ComparisonDateRange | null {
  if (options.mode === "none") return null;
  if (options.mode === "custom") {
    if (options.dateRange === undefined) return null;
    const from = assertIsoDate(options.dateRange.from, "Inicio de la comparación");
    const to = assertIsoDate(options.dateRange.to, "Fin de la comparación");
    if (from > to) throw new Error("El inicio de la comparación debe ser anterior al final.");
    return { from, to };
  }
  if (options.mode === "previousYear" || filtered.filters.periodMode === "year") {
    return { from: previousYearDate(current.from), to: previousYearDate(current.to) };
  }
  if (filtered.filters.periodMode === "month") {
    const monthStart = filtered.source.backup?.preferences.monthStart ?? 1;
    const selectedMonth = monthPeriodForDate(current.from, monthStart);
    if (selectedMonth.startDate === current.from && current.to <= selectedMonth.endDate) {
      const previousMonth = monthPeriodForDate(addIsoDays(current.from, -1), monthStart);
      if (current.to === selectedMonth.endDate) {
        return { from: previousMonth.startDate, to: previousMonth.endDate };
      }
      // The current month selector stops at today; compare the same elapsed
      // part of the previous calendar month, clamped to its last day.
      const elapsedDays = Math.round((Date.parse(current.to) - Date.parse(current.from)) / 86_400_000);
      const elapsedEnd = addIsoDays(previousMonth.startDate, elapsedDays);
      return { from: previousMonth.startDate, to: elapsedEnd < previousMonth.endDate ? elapsedEnd : previousMonth.endDate };
    }
  }
  const days = Math.round((Date.parse(current.to) - Date.parse(current.from)) / 86_400_000) + 1;
  return { from: addIsoDays(current.from, -days), to: addIsoDays(current.from, -1) };
}

function addMinor(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("Comparison amount exceeds the safe integer range");
  return result === 0 ? 0 : result;
}

function comparisonAmounts(filtered: FilteredAnalyticsDataset) {
  const summary = aggregateKpis(filtered);
  let realOutflows = 0;
  let realInflows = 0;
  for (const posting of filtered.activePostings) {
    if (posting.accountType !== "DEFAULT") continue;
    if (posting.amountEurMinor < 0) realOutflows = addMinor(realOutflows, -posting.amountEurMinor);
    else realInflows = addMinor(realInflows, posting.amountEurMinor);
  }
  let debtSent = 0;
  let debtReceived = 0;
  let debtNetExpense = 0;
  let debtClosing = 0;
  for (const debt of aggregateDebtBreakdown(filtered)) {
    debtSent = addMinor(debtSent, debt.advancesEurMinor);
    debtReceived = addMinor(debtReceived, debt.recoveriesEurMinor);
    debtNetExpense = addMinor(debtNetExpense, addMinor(debt.grossDebtExpensesEurMinor, -debt.debtExpenseRefundsEurMinor));
    debtClosing = addMinor(debtClosing, debt.periodClosingBalanceEurMinor);
  }
  return [
    { key: "realCashFlow", label: "Flujo de cuentas reales", amount: summary.realCashFlowEurMinor },
    { key: "realOutflows", label: "Salidas de cuentas reales", amount: realOutflows },
    { key: "realInflows", label: "Entradas en cuentas reales", amount: realInflows },
    { key: "net", label: "Neto seleccionado", amount: summary.netEurMinor },
    { key: "expenses", label: "Gasto neto seleccionado", amount: -summary.expensesEurMinor || 0 },
    { key: "grossExpenses", label: "Gasto bruto seleccionado", amount: summary.grossExpensesEurMinor },
    { key: "expenseRefunds", label: "Devoluciones de gasto seleccionadas", amount: summary.expenseRefundsEurMinor },
    { key: "debtExpenseAdjustments", label: "Contrapartidas de deuda en gastos", amount: summary.debtExpenseAdjustmentsEurMinor ?? 0 },
    { key: "income", label: "Ingreso neto seleccionado", amount: summary.incomesEurMinor },
    { key: "grossIncome", label: "Ingreso bruto seleccionado", amount: summary.grossIncomeEurMinor },
    { key: "incomeReversals", label: "Reversiones de ingreso seleccionadas", amount: summary.incomeReversalsEurMinor },
    { key: "debtIncomeAdjustments", label: "Contrapartidas de deuda en ingresos", amount: summary.debtIncomeAdjustmentsEurMinor ?? 0 },
    { key: "debt", label: "Movimiento de deuda seleccionado", amount: summary.debtFlowEurMinor },
    { key: "debtSent", label: "Enviado a cuentas de deuda seleccionadas", amount: debtSent },
    { key: "debtReceived", label: "Recibido desde cuentas de deuda seleccionadas", amount: debtReceived },
    { key: "debtNetExpense", label: "Gasto neto atribuido a deudas seleccionadas", amount: debtNetExpense },
    { key: "debtClosing", label: "Saldo final completo de cuentas de deuda", amount: debtClosing },
  ];
}

export function buildPeriodComparison(
  filtered: FilteredAnalyticsDataset,
  options: PeriodComparisonOptions,
): PeriodComparisonResult | null {
  if (options.mode === "none") return null;
  const currentRange = comparisonCurrentRange(filtered);
  if (currentRange === null) return null;
  const referenceRange = referenceDateRange(filtered, currentRange, options);
  if (referenceRange === null) return null;
  const reference = applyFilters(filtered.source, {
    ...filtered.filters,
    periodMode: "custom",
    dateRange: referenceRange,
  });
  const referenceAmounts = comparisonAmounts(reference);
  const history = datasetDateRange(filtered);
  return {
    currentRange,
    referenceRange,
    currentPostingCount: filtered.activePostings.length,
    referencePostingCount: reference.activePostings.length,
    referenceOutsideHistory: history === null || referenceRange.from < history.from || referenceRange.to > history.to,
    metrics: comparisonAmounts(filtered).map((metric, index) => {
      const referenceEurMinor = referenceAmounts[index]!.amount;
      const deltaEurMinor = addMinor(metric.amount, -referenceEurMinor);
      return {
        key: metric.key,
        label: metric.label,
        currentEurMinor: metric.amount,
        referenceEurMinor,
        deltaEurMinor,
        deltaPercent: referenceEurMinor === 0 ? null : deltaEurMinor / Math.abs(referenceEurMinor) * 100,
      };
    }),
  };
}
