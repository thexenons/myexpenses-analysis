import { aggregateAccountBreakdown, aggregateTimeSeries } from "../../../domain/analytics/aggregations.ts";
import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { datasetDateBounds } from "../../../domain/analytics/date-bounds.ts";
import type { FilteredAnalyticsDataset, IsoDate, TimeGranularity } from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import { resolveAccountExchangeRate } from "./components/AccountDetails/AccountDetails.helpers.ts";
import type {
  AccountsPageViewProps,
  AccountTotals,
  AccountMetric,
} from "./AccountsPage.types.ts";

export const ACCOUNT_METRIC_LABELS = {
  periodClosingBalanceEurMinor: "Saldo real al cierre",
  netEurMinor: "Movimiento neto filtrado",
  expensesEurMinor: "Gasto neto (con signo)",
  incomesEurMinor: "Ingresos netos",
  realCashFlowEurMinor: "Flujo de caja real",
  debtFlowEurMinor: "Movimiento en deudas",
} as const;

export function createAccountsPageModel(
  filtered: FilteredAnalyticsDataset | null,
  onSelectAccount: (accountId: string) => void,
  metric: AccountMetric = "periodClosingBalanceEurMinor",
  granularity: TimeGranularity = "month",
  onMetricChange?: (metric: AccountMetric) => void,
  onViewTransactions?: (accountId: string) => void,
  onViewPeriod?: (label: string) => void,
): AccountsPageViewProps {
  const breakdown =
    filtered === null ? [] : aggregateAccountBreakdown(filtered);
  const accounts = breakdown.map((item) =>
    Object.assign({}, item, {
      exchangeRateToEur: resolveAccountExchangeRate(
        item.account,
        filtered?.source.source.accounts.accounts[item.account.id],
      ),
    }),
  );
  const totals = accounts.reduce<AccountTotals>(
    (result, account) => ({
      closingEurMinor:
        result.closingEurMinor + account.periodClosingBalanceEurMinor,
      debtCount:
        result.debtCount + (account.account.type === "DEBT" ? 1 : 0),
      flowEurMinor: result.flowEurMinor + account.netEurMinor,
      postingCount: result.postingCount + account.postingCount,
    }),
    {
      closingEurMinor: 0,
      debtCount: 0,
      flowEurMinor: 0,
      postingCount: 0,
    },
  );
  const dateBounds = filtered === null ? null : datasetDateBounds(filtered.source, filtered.filters.dateBasis);
  const fromCandidates = [dateBounds?.minDate, filtered?.filters.dateRange.to]
    .filter((date): date is IsoDate => date != null).toSorted();
  const toCandidates = [dateBounds?.maxDate, filtered?.filters.dateRange.from]
    .filter((date): date is IsoDate => date != null).toSorted();
  const balanceDateRange = {
    from: filtered?.filters.dateRange.from ?? fromCandidates[0] ?? null,
    to: filtered?.filters.dateRange.to ?? toCandidates.at(-1) ?? null,
  };

  return {
    accountBars: accounts.toSorted((left, right) => Math.abs(right[metric]) - Math.abs(left[metric])).map((account) => ({
      id: account.account.id,
      label: account.account.label,
      value: euroFromMinor(account[metric]),
      color:
        account.account.type === "DEBT"
          ? "#bd7d2f"
          : account[metric] >= 0
            ? "#286a4c"
            : "#a33f36",
    })),
    accountSeries: filtered === null ? [] : accounts.map((item) => {
      const scoped = applyFilters(filtered.source, metric === "periodClosingBalanceEurMinor"
        ? {
          ...createDefaultFilterState(),
          accountIds: [item.account.id],
          dateRange: balanceDateRange,
          dateBasis: filtered.filters.dateBasis,
          periodMode: filtered.filters.periodMode,
        }
        : { ...filtered.filters, accountIds: [item.account.id] });
      let balance = scoped.periodOpeningBalanceEurMinor;
      return {
        id: item.account.id,
        label: item.account.label,
        color: item.account.type === "DEBT" ? "#bd7d2f" : item[metric] >= 0 ? "#286a4c" : "#a33f36",
        data: aggregateTimeSeries(scoped, granularity).map((point) => {
          balance += point.netEurMinor;
          return {
            label: point.key,
            value: euroFromMinor(metric === "periodClosingBalanceEurMinor" ? balance : point[metric]),
          };
        }),
      };
    }),
    accounts,
    metric,
    onMetricChange,
    onSelectAccount,
    onViewTransactions,
    onViewPeriod,
    totals,
  };
}
