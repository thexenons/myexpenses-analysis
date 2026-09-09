import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { accountMatchesScope } from "../../../../domain/analytics/filters.ts";
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import {
  createDebtsPageModel,
  toggleDebtAccountIds,
} from "../DebtsPage.helpers.ts";
import type { DebtsPageViewProps } from "../DebtsPage.types.ts";

export function useDebtsPage(): DebtsPageViewProps | null {
  const navigate = useNavigate();
  const { analytics, filtered, filters, granularity } = useFilteredAnalytics();
  const patchFilters = useAppStore((state) => state.actions.patchFilters);
  const debtAccountIds = useMemo(
    () =>
      new Set(
        analytics?.accounts
          .filter((account) => accountMatchesScope(account, "debtsOnly"))
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
        filters.scope === "realCashFlow" ? [] : filters.accountIds.length === 0
          ? debtAccountIds
          : selectedDebtAccountIds,
      ),
    [debtAccountIds, filters.accountIds.length, filters.scope, selectedDebtAccountIds],
  );
  const onClearAccounts = useCallback(
    () => patchFilters({ accountIds: [], scope: "debtsOnly" }),
    [patchFilters],
  );
  const onToggleAccount = useCallback(
    (accountId: string) => {
      patchFilters({
        accountIds: filters.scope === "realCashFlow"
          ? [accountId]
          : toggleDebtAccountIds(filters.accountIds, debtAccountIds, accountId),
        scope: "debtsOnly",
      });
    },
    [
      debtAccountIds,
      filters.accountIds,
      filters.scope,
      patchFilters,
    ],
  );
  const onViewTransactions = useCallback(
    (accountId?: string) => {
      patchFilters({
        ...(accountId === undefined ? {} : { accountIds: [accountId] }),
        scope: "debtsOnly",
      });
      void navigate({
        to: "/transacciones",
        search: { page: 1, sort: "date", direction: "desc" },
      });
    },
    [navigate, patchFilters],
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
            onViewTransactions,
          ),
    [
      analytics,
      effectiveSelectedAccountIds,
      filtered,
      granularity,
      onClearAccounts,
      onToggleAccount,
      onViewTransactions,
    ],
  );
}
