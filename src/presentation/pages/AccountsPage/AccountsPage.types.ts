import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/index.ts";
import type { AccountBreakdownItem } from "../../../domain/analytics/types.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/index.ts";

export type AccountMetric = "periodClosingBalanceEurMinor" | "netEurMinor" | "expensesEurMinor" | "incomesEurMinor" | "realCashFlowEurMinor" | "debtFlowEurMinor";

export interface AccountTotals {
  readonly closingEurMinor: number;
  readonly debtCount: number;
  readonly flowEurMinor: number;
  readonly postingCount: number;
}

export interface AccountPageItem extends AccountBreakdownItem {
  readonly exchangeRateToEur: number | null;
}

export interface AccountsPageViewProps {
  readonly accountBars: readonly ChartBarDatum[];
  readonly accountSeries?: readonly ChartSeries[];
  readonly accounts: readonly AccountPageItem[];
  readonly onSelectAccount: (accountId: string) => void;
  readonly metric?: AccountMetric;
  readonly onMetricChange?: (metric: AccountMetric) => void;
  readonly onViewTransactions?: (accountId: string) => void;
  readonly onViewPeriod?: (label: string) => void;
  readonly totals: AccountTotals;
}
