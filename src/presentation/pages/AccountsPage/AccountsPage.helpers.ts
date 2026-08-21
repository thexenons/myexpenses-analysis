import { aggregateAccountBreakdown } from "../../../domain/analytics/aggregations.ts";
import type { FilteredAnalyticsDataset } from "../../../domain/analytics/types.ts";
import { euroFromMinor } from "../../utils/format.ts";
import { resolveAccountExchangeRate } from "./components/AccountDetails/AccountDetails.helpers.ts";
import type {
  AccountsPageViewProps,
  AccountTotals,
} from "./AccountsPage.types.ts";

export function createAccountsPageModel(
  filtered: FilteredAnalyticsDataset | null,
  onSelectAccount: (accountId: string) => void,
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

  return {
    accountBars: accounts.slice(0, 18).map((account) => ({
      id: account.account.id,
      label: account.account.label,
      value: euroFromMinor(account.periodClosingBalanceEurMinor),
      color:
        account.account.type === "DEBT"
          ? "#bd7d2f"
          : account.periodClosingBalanceEurMinor >= 0
            ? "#286a4c"
            : "#a33f36",
    })),
    accounts,
    onSelectAccount,
    totals,
  };
}
