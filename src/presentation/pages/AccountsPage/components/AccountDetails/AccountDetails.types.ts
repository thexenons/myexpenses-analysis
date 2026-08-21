import type { AccountBreakdownItem } from "../../../../../domain/analytics/types.ts";

export interface AccountDetailsProps {
  readonly exchangeRateToEur: number | null;
  readonly item: AccountBreakdownItem;
}
