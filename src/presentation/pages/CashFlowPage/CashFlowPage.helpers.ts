import {
  aggregateCategoryBreakdown,
  aggregateFlowComposition,
  aggregateKpis,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import { buildCumulativeTimeSeries } from "../../../domain/analytics/cumulative-time-series.ts";
import type {
  TimeSeriesPoint,
  FilteredAnalyticsDataset,
  TimeGranularity,
  TransactionStatus,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type { CashFlowPageViewProps } from "./CashFlowPage.types.ts";

const CASH_FLOW_LINE_METRICS = [
  { id: "cashflow", label: "Flujo real", color: "#10251e", key: "realCashFlowEurMinor" },
  { id: "total", label: "Movimiento total", color: "#35698b", key: "netEurMinor" },
] as const;

function cashFlowChartSeries(points: readonly TimeSeriesPoint[]): CashFlowPageViewProps["lineSeries"] {
  return CASH_FLOW_LINE_METRICS.map((metric) => ({
    id: metric.id, label: metric.label, color: metric.color,
    data: points.map((point) => ({ label: point.key, value: euroFromMinor(point[metric.key]), valueEurMinor: point[metric.key] })),
  }));
}

export function createCashFlowPageModel(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  selectedStatuses: readonly TransactionStatus[] = [],
): CashFlowPageViewProps {
  const kpis = aggregateKpis(filtered);
  const composition = aggregateFlowComposition(filtered);
  const series = aggregateTimeSeries(filtered, granularity);
  const cumulativeSeries = buildCumulativeTimeSeries(series);
  const categories = aggregateCategoryBreakdown(filtered);
  const realPostings = filtered.activePostings.filter((posting) => posting.accountType === "DEFAULT");
  const inflows = new Map(aggregateTimeSeries({ ...filtered, activePostings: realPostings.filter((posting) => posting.amountEurMinor > 0) }, granularity)
    .map((point) => [point.key, point.netEurMinor]));
  const outflows = new Map(aggregateTimeSeries({ ...filtered, activePostings: realPostings.filter((posting) => posting.amountEurMinor < 0) }, granularity)
    .map((point) => [point.key, -point.netEurMinor]));

  return {
    composition,
    expenseCategories: categories
      .filter((category) => category.summary.expensesEurMinor !== 0),
    kpis,
    lineSeries: cashFlowChartSeries(series),
    cumulativeLineSeries: cumulativeSeries === null ? null : cashFlowChartSeries(cumulativeSeries),
    periodBars: series.map((point) => ({
      id: point.key,
      label: point.key,
      leftValue: euroFromMinor(outflows.get(point.key) ?? 0),
      rightValue: euroFromMinor(inflows.get(point.key) ?? 0),
    })),
    savingsEurMinor: kpis.incomesEurMinor + kpis.expensesEurMinor,
    trendFiltered: selectedStatuses.length > 0
      ? { ...filtered, filters: { ...filtered.filters, statuses: selectedStatuses } }
      : filtered,
  };
}
