import {
  aggregateDebtBreakdown,
  aggregateTimeSeries,
} from "../../../domain/analytics/aggregations.ts";
import {
  applyFilters,
  createDefaultFilterState,
} from "../../../domain/analytics/filters.ts";
import type {
  AnalyticsDataset,
  FilteredAnalyticsDataset,
  TimeGranularity,
} from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import { datasetDateBounds } from "../../../domain/analytics/date-bounds.ts";
import type {
  DebtsPageViewProps,
  DebtTotals,
} from "./DebtsPage.types.ts";

export function toggleDebtAccountIds(
  accountIds: readonly string[],
  debtAccountIds: ReadonlySet<string>,
  accountId: string,
): readonly string[] {
  if (!debtAccountIds.has(accountId)) return accountIds;
  const selectedDebtIds = accountIds.length === 0
    ? [...debtAccountIds]
    : accountIds.filter((candidate) => debtAccountIds.has(candidate));
  const next = selectedDebtIds.includes(accountId)
    ? selectedDebtIds.filter((candidate) => candidate !== accountId)
    : [...selectedDebtIds, accountId];
  // The global empty selection means "all", so never turn removing the last
  // selected account into silently selecting every account again.
  return next.length === 0 ? selectedDebtIds : next;
}

export function createDebtsPageModel(
  analytics: AnalyticsDataset,
  filtered: FilteredAnalyticsDataset,
  granularity: TimeGranularity,
  selectedAccountIds: ReadonlySet<string>,
  onClearAccounts: () => void,
  onToggleAccount: (accountId: string) => void,
  onViewTransactions: (accountId?: string) => void,
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
      expenseRefundsEurMinor:
        result.expenseRefundsEurMinor + debt.debtExpenseRefundsEurMinor,
      flowEurMinor: result.flowEurMinor + debt.netEurMinor,
      recoveriesEurMinor: result.recoveriesEurMinor + debt.recoveriesEurMinor,
    }),
    {
      advancesEurMinor: 0,
      balanceEurMinor: 0,
      expensesEurMinor: 0,
      expenseRefundsEurMinor: 0,
      flowEurMinor: 0,
      recoveriesEurMinor: 0,
    },
  );
  let cumulativeBalanceEurMinor = debts.reduce(
    (sum, debt) => sum + debt.periodOpeningBalanceEurMinor,
    0,
  );
  const bounds = datasetDateBounds(analytics, filtered.filters.dateBasis);
  const starts = [bounds.minDate, filtered.filters.dateRange.to].filter((date) => date !== null).toSorted();
  const ends = [bounds.maxDate, filtered.filters.dateRange.from].filter((date) => date !== null).toSorted();
  const balanceSeries = debts.length === 0 ? [] : aggregateTimeSeries(
    applyFilters(analytics, {
      ...createDefaultFilterState(),
      accountIds: debts.map((debt) => debt.account.id),
      dateRange: {
        from: filtered.filters.dateRange.from ?? starts[0] ?? null,
        to: filtered.filters.dateRange.to ?? ends.at(-1) ?? null,
      },
      dateBasis: filtered.filters.dateBasis ?? "operation",
      periodMode: filtered.filters.periodMode,
      scope: "debtsOnly",
    }),
    granularity,
  );
  const cumulativeBalance = balanceSeries.map((point) => {
    cumulativeBalanceEurMinor += point.debtFlowEurMinor;
    return {
      label: point.key,
      value: euroFromMinor(cumulativeBalanceEurMinor),
    };
  });

  return {
    accountBars: debts.map((debt) => ({
      id: debt.account.id,
      label: debt.account.label,
      value: euroFromMinor(debt.periodClosingBalanceEurMinor),
      color:
        debt.periodClosingBalanceEurMinor >= 0 ? "#bd7d2f" : "#a33f36",
    })),
    debtSeries: [
      {
        id: "debt-flow",
        label: "Movimiento filtrado",
        color: "#bd7d2f",
        data: series.map((point) => ({
          label: point.key,
          value: euroFromMinor(point.debtFlowEurMinor),
        })),
      },
      {
        id: "debt-balance",
        label: "Saldo real de las cuentas",
        color: "#35698b",
        data: cumulativeBalance,
      },
    ],
    availableDebts,
    debts,
    onClearAccounts,
    onToggleAccount,
    onViewTransactions,
    selectedAccountIds,
    showClearAccounts: filtered.filters.accountIds.length > 0 ||
      filtered.filters.scope === "realCashFlow",
    totals,
  };
}
