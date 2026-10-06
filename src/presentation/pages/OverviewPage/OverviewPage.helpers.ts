import {
  aggregateAccountBreakdown,
  aggregateCategoryBreakdown,
  aggregateFlowComposition,
  aggregateKpis,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import { buildCumulativeTimeSeries } from "../../../domain/analytics/cumulative-time-series.ts";
import type {
  CategoryType,
  FilterState,
  TimeSeriesPoint,
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor, formatDate } from "../../utils/format.ts";
import type {
  OverviewAmountRow,
  OverviewReview,
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

const REVIEW_CATEGORY_TYPES: readonly CategoryType[] = ["EXPENSE", "INCOME", "NEUTRAL"];

export function createOverviewReviewPatch(filters: FilterState): Partial<FilterState> | null {
  const categoryTypes = filters.categoryTypes?.length
    ? filters.categoryTypes.filter((type) => REVIEW_CATEGORY_TYPES.includes(type))
    : REVIEW_CATEGORY_TYPES;
  if (categoryTypes.length === 0 || filters.linked === "linked") return null;
  // Called only for visible evidence. Unlinked empty paths share the original
  // category predicate, so replacing it cannot admit another category or peer.
  return { categoryPrefixes: [[]], categoryDepth: "exact", categoryMode: "include",
    categoryMatch: "posting", categoryTypes, linked: "unlinked" };
}

function createOverviewReview(filtered: FilteredAnalyticsDataset): OverviewReview {
  let uncategorized = 0;
  for (const posting of filtered.activePostings) {
    if (!posting.linked && posting.categoryPath.length === 0 &&
      (posting.bucket === "expense" || posting.bucket === "income")) uncategorized += 1;
  }
  const { dateRange, dateBasis, scope } = filtered.filters;
  const range = dateRange.from === null && dateRange.to === null ? "Intervalo observado"
    : `${dateRange.from === null ? "Inicio observado" : formatDate(dateRange.from)} – ${dateRange.to === null ? "Final observado" : formatDate(dateRange.to)}`;
  const scopeLabel = { all: "Ámbito general", realCashFlow: "Flujo real", debtsOnly: "Solo deudas" }[scope];
  return {
    context: `${scopeLabel} · ${dateBasis === "value" ? "Fecha valor" : "Fecha de operación"} · ${range}`,
    hasData: filtered.activePostings.length > 0,
    signals: uncategorized === 0 ? [] : [{ id: "uncategorized", count: uncategorized }],
  };
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
    review: createOverviewReview(filtered),
    topCategories: categories.map((category) => ({ category })),
    valuationBalanceEurMinor,
  };
}
