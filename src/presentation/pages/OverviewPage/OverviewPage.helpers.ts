import {
  aggregateAccountBreakdown,
  aggregateCategoryBreakdown,
  aggregateFlowComposition,
  aggregateKpis,
  aggregateStatusCounts,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import { buildCumulativeTimeSeries } from "../../../domain/analytics/cumulative-time-series.ts";
import type {
  TimeSeriesPoint,
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type {
  OverviewAmountRow,
  OverviewPageViewProps,
} from "./OverviewPage.types.ts";

const OVERVIEW_LINE_METRICS = [
  { id: "income", label: "Ingresos", color: "#286a4c", key: "incomesEurMinor" },
  { id: "expenses", label: "Movimiento contable de gastos", color: "#a33f36", key: "expensesEurMinor" },
  { id: "net", label: "Flujo neto", color: "#35698b", key: "netEurMinor" },
] as const;

function overviewChartSeries(points: readonly TimeSeriesPoint[]): OverviewPageViewProps["chartSeries"] {
  return OVERVIEW_LINE_METRICS.map((metric) => ({
    id: metric.id, label: metric.label, color: metric.color,
    data: points.map((point) => ({ label: point.key, value: euroFromMinor(point[metric.key]), valueEurMinor: point[metric.key] })),
  }));
}

export function createOverviewPageModel(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  searchPending: boolean,
): OverviewPageViewProps {
  const kpis = aggregateKpis(filtered);
  const categories = aggregateCategoryBreakdown(filtered);
  const accounts = aggregateAccountBreakdown(filtered);
  const composition = aggregateFlowComposition(filtered);
  const status = aggregateStatusCounts(filtered);
  const series = aggregateTimeSeries(filtered, granularity);
  const cumulativeSeries = buildCumulativeTimeSeries(series);
  const debtAccounts = accounts.filter(
    (account) => account.account.type === "DEBT",
  );
  const debtBalanceEurMinor = debtAccounts.reduce(
    (sum, account) => sum + account.periodClosingBalanceEurMinor,
    0,
  );
  const valuationBalanceEurMinor = filtered.accounts.reduce(
    (sum, account) => sum + account.valuationBalanceEurMinor,
    0,
  );
  const expenseComposition: readonly OverviewAmountRow[] = [
    {
      amountEurMinor: composition.grossExpensesEurMinor,
      label: "Gasto bruto",
    },
    {
      amountEurMinor: composition.expenseRefundsEurMinor,
      label: "Devoluciones",
    },
    {
      amountEurMinor: composition.debtExpenseAdjustmentsEurMinor ?? 0,
      label: "Asignación de gasto en deudas (con signo)",
    },
    {
      amountEurMinor: -composition.netExpensesEurMinor,
      label: "Gasto neto",
    },
    {
      amountEurMinor: composition.incomeReversalsEurMinor,
      label: "Reversiones de ingreso",
    },
    {
      amountEurMinor: composition.debtIncomeAdjustmentsEurMinor ?? 0,
      label: "Asignación de ingreso en deudas (con signo)",
    },
  ];

  return {
    accounts,
    chartSeries: overviewChartSeries(series),
    cumulativeChartSeries: cumulativeSeries === null ? null : overviewChartSeries(cumulativeSeries),
    debtAccountCount: debtAccounts.length,
    debtBalanceEurMinor,
    expenseComposition,
    kpis,
    searchPending,
    status,
    topCategories: categories.map((category) => ({ category })),
    valuationBalanceEurMinor,
  };
}
