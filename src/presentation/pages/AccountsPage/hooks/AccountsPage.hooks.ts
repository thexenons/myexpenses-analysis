import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { aggregateTimeSeries } from "../../../../domain/analytics/aggregations.ts";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createAccountsPageModel } from "../AccountsPage.helpers.ts";
import type { AccountMetric, AccountsPageViewProps } from "../AccountsPage.types.ts";

export function useAccountsPage(): AccountsPageViewProps {
  const { filtered, granularity } = useFilteredAnalytics();
  const navigate = useNavigate();
  const [metric, onMetricChange] = useState<AccountMetric>("periodClosingBalanceEurMinor");
  const setAccountIds = useAppStore((state) => state.actions.setAccountIds);
  const patchFilters = useAppStore((state) => state.actions.patchFilters);
  const onSelectAccount = useCallback(
    (accountId: string) => setAccountIds([accountId]),
    [setAccountIds],
  );
  const onViewTransactions = useCallback((accountId: string) => {
    setAccountIds([accountId]);
    void navigate({ to: "/transacciones", search: { page: 1, sort: "date", direction: "desc" } });
  }, [navigate, setAccountIds]);
  const onViewPeriod = useCallback((label: string) => {
    if (filtered === null) return;
    const period = aggregateTimeSeries(filtered, granularity).find((point) => point.key === label);
    if (period === undefined) return;
    const range = filtered.filters.dateRange;
    patchFilters({
      periodMode: "custom",
      dateRange: {
        from: range.from !== null && range.from > period.startDate ? range.from : period.startDate,
        to: range.to !== null && range.to < period.endDate ? range.to : period.endDate,
      },
    });
    void navigate({ to: "/transacciones", search: { page: 1, sort: "date", direction: "desc" } });
  }, [filtered, granularity, navigate, patchFilters]);

  return useMemo(
    () => createAccountsPageModel(filtered, onSelectAccount, metric, granularity, onMetricChange, onViewTransactions, onViewPeriod),
    [filtered, onSelectAccount, metric, granularity, onViewTransactions, onViewPeriod],
  );
}
