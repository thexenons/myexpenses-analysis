import {
  aggregateDebtBreakdown,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import type {
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type {
  DebtsPageViewProps,
  DebtTotals,
} from "./DebtsPage.types.ts";

export function createDebtsPageModel(
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
): DebtsPageViewProps {
  const debts = aggregateDebtBreakdown(filtered);
  const series = aggregateTimeSeries(filtered, granularity);
  const totals = debts.reduce<DebtTotals>(
    (result, debt) => ({
      advancesEurMinor: result.advancesEurMinor + debt.advancesEurMinor,
      balanceEurMinor:
        result.balanceEurMinor + debt.periodClosingBalanceEurMinor,
      expensesEurMinor:
        result.expensesEurMinor + debt.grossDebtExpensesEurMinor,
      recoveriesEurMinor: result.recoveriesEurMinor + debt.recoveriesEurMinor,
    }),
    {
      advancesEurMinor: 0,
      balanceEurMinor: 0,
      expensesEurMinor: 0,
      recoveriesEurMinor: 0,
    },
  );

  return {
    accountBars: debts.slice(0, 12).map((debt) => ({
      id: debt.account.id,
      label: debt.account.label,
      value: euroFromMinor(debt.periodClosingBalanceEurMinor),
      color:
        debt.periodClosingBalanceEurMinor >= 0 ? "#bd7d2f" : "#a33f36",
    })),
    debtSeries: [
      {
        id: "debt-flow",
        label: "Movimiento en deudas",
        color: "#bd7d2f",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.debtFlowEurMinor),
        })),
      },
      {
        id: "real-flow",
        label: "Flujo real",
        color: "#286a4c",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.realCashFlowEurMinor),
        })),
      },
    ],
    debts,
    totals,
  };
}
