import {
  aggregateCategoryBreakdown,
  aggregateFlowComposition,
  aggregateKpis,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import type {
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type { CashFlowPageViewProps } from "./CashFlowPage.types.ts";

export function createCashFlowPageModel(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
): CashFlowPageViewProps {
  const kpis = aggregateKpis(filtered);
  const composition = aggregateFlowComposition(filtered);
  const series = aggregateTimeSeries(filtered, granularity);
  const categories = aggregateCategoryBreakdown(filtered);

  return {
    composition,
    expenseCategories: categories
      .filter((category) => category.summary.expensesEurMinor !== 0)
      .slice(0, 8),
    kpis,
    lineSeries: [
      {
        id: "cashflow",
        label: "Flujo real",
        color: "#10251e",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.realCashFlowEurMinor),
        })),
      },
      {
        id: "total",
        label: "Movimiento total",
        color: "#35698b",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.netEurMinor),
        })),
      },
    ],
    periodBars: series.map((point) => ({
      id: point.key,
      label: point.key,
      leftValue: euroFromMinor(Math.abs(point.expensesEurMinor)),
      rightValue: euroFromMinor(point.incomesEurMinor),
    })),
    savingsEurMinor: kpis.incomesEurMinor + kpis.expensesEurMinor,
  };
}
