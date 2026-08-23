import {
  aggregateDebtBreakdown,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
import type {
  AnalyticsDataset,
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import type {
  DebtsPageViewProps,
  DebtTotals,
} from "./DebtsPage.types.ts";

export function toggleDebtAccountIds(
  accountIds: readonly string[],
  debtAccountIds: ReadonlySet<string>,
  accountId: string,
): readonly string[] {
  if (accountIds.length === 0) return [accountId];
  const selectedDebtIds = accountIds.filter((candidate) =>
    debtAccountIds.has(candidate),
  );
  const next = selectedDebtIds.includes(accountId)
    ? selectedDebtIds.filter((candidate) => candidate !== accountId)
    : [...selectedDebtIds, accountId];
  return next.length === 0 ? [] : next;
}

export function createDebtsPageModel(
  analytics: AnalyticsDataset,
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  selectedAccountIds: ReadonlySet<string>,
  onClearAccounts: () => void,
  onToggleAccount: (accountId: string) => void,
): DebtsPageViewProps {
  const debts = aggregateDebtBreakdown(filtered);
  const availableDebts = aggregateDebtBreakdown(
    applyFilters(analytics, {
      ...filtered.filters,
      accountIds: [],
      scope: "all",
    }),
  );
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
  let cumulativeBalanceEurMinor = debts.reduce(
    (sum, debt) => sum + debt.periodOpeningBalanceEurMinor,
    0,
  );
  const cumulativeBalance = series.map((point) => {
    cumulativeBalanceEurMinor += point.debtFlowEurMinor;
    return {
      label: point.key,
      value: euroFromMinor(cumulativeBalanceEurMinor),
    };
  });

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
        id: "debt-balance",
        label: "Saldo acumulado",
        color: "#35698b",
        data: cumulativeBalance,
      },
    ],
    availableDebts,
    debts,
    onClearAccounts,
    onToggleAccount,
    selectedAccountIds,
    showClearAccounts: filtered.filters.accountIds.length > 0,
    totals,
  };
}
