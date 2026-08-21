import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/index.ts";
import type { ChartSeries } from "../../components/organisms/LineChart/index.ts";
import type { DebtBreakdownItem } from "../../../domain/analytics/types.ts";

export interface DebtTotals {
  readonly advancesEurMinor: number;
  readonly balanceEurMinor: number;
  readonly expensesEurMinor: number;
  readonly recoveriesEurMinor: number;
}

export interface DebtsPageViewProps {
  readonly accountBars: readonly ChartBarDatum[];
  readonly debtSeries: readonly ChartSeries[];
  readonly debts: readonly DebtBreakdownItem[];
  readonly totals: DebtTotals;
}
