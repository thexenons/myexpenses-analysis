import { useCallback, useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import {
  createDebtsPageModel,
  toggleDebtAccountIds,
} from "../DebtsPage.helpers.ts";
import type { DebtsPageViewProps } from "../DebtsPage.types.ts";

export function useDebtsPage(): DebtsPageViewProps | null {
  const { analytics, filtered, filters, granularity } = useFilteredAnalytics();
  const patchFilters = useAppStore((state) => state.actions.patchFilters);
  const setAccountIds = useAppStore((state) => state.actions.setAccountIds);
  const debtAccountIds = useMemo(
    () =>
      new Set(
        analytics?.accounts
          .filter((account) => account.type === "DEBT")
          .map((account) => account.id) ?? [],
      ),
    [analytics],
  );
  const selectedDebtAccountIds = useMemo(
    () => filters.accountIds.filter((accountId) => debtAccountIds.has(accountId)),
    [debtAccountIds, filters.accountIds],
  );
  const effectiveSelectedAccountIds = useMemo(
    () =>
      new Set(
        filters.accountIds.length === 0
          ? debtAccountIds
          : selectedDebtAccountIds,
      ),
    [debtAccountIds, filters.accountIds.length, selectedDebtAccountIds],
  );
  const onClearAccounts = useCallback(
    () => setAccountIds([]),
    [setAccountIds],
  );
  const onToggleAccount = useCallback(
    (accountId: string) => {
      if (filters.scope === "realCashFlow") {
        patchFilters({ scope: "debtsOnly" });
      }
      setAccountIds(
        toggleDebtAccountIds(filters.accountIds, debtAccountIds, accountId),
      );
    },
    [
      debtAccountIds,
      filters.accountIds,
      filters.scope,
      patchFilters,
      setAccountIds,
    ],
  );

  return useMemo(
    () =>
      analytics === null || filtered === null
        ? null
        : createDebtsPageModel(
            analytics,
            filtered,
            granularity,
            effectiveSelectedAccountIds,
            onClearAccounts,
            onToggleAccount,
          ),
    [
      analytics,
      effectiveSelectedAccountIds,
      filtered,
      granularity,
      onClearAccounts,
      onToggleAccount,
    ],
  );
}
