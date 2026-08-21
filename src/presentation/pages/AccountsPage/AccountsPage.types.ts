import type { ChartBarDatum } from "../../components/organisms/HorizontalBarChart/index.ts";
import type { AccountBreakdownItem } from "../../../domain/analytics/types.ts";

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
  readonly accounts: readonly AccountPageItem[];
  readonly onSelectAccount: (accountId: string) => void;
  readonly totals: AccountTotals;
}
