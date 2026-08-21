import {
  aggregateAccountBreakdown,
  aggregateCategoryBreakdown,
  aggregateFlowComposition,
  aggregateKpis,
  aggregateStatusCounts,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import type {
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type {
  OverviewAmountRow,
  OverviewPageViewProps,
} from "./OverviewPage.types.ts";

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
  const topCategoryNodes = categories.slice(0, 7);
  const maxCategoryActivity = Math.max(
    ...topCategoryNodes.map((category) =>
      Math.abs(category.summary.netEurMinor),
    ),
    1,
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
      amountEurMinor: Math.abs(composition.netExpensesEurMinor),
      label: "Gasto neto",
    },
    {
      amountEurMinor: composition.incomeReversalsEurMinor,
      label: "Reversiones de ingreso",
    },
  ];

  return {
    accounts,
    chartSeries: [
      {
        id: "income",
        label: "Ingresos",
        color: "#286a4c",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.incomesEurMinor),
        })),
      },
      {
        id: "expenses",
        label: "Gastos",
        color: "#a33f36",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.expensesEurMinor),
        })),
      },
      {
        id: "net",
        label: "Flujo neto",
        color: "#35698b",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.netEurMinor),
        })),
      },
    ],
    debtAccountCount: debtAccounts.length,
    debtBalanceEurMinor,
    expenseComposition,
    kpis,
    searchPending,
    status,
    topCategories: topCategoryNodes.map((category) => ({
      activityPercent:
        (Math.abs(category.summary.netEurMinor) / maxCategoryActivity) * 100,
      category,
    })),
    valuationBalanceEurMinor,
  };
}
