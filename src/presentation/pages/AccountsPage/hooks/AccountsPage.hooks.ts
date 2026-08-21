import { useCallback, useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createAccountsPageModel } from "../AccountsPage.helpers.ts";
import type { AccountsPageViewProps } from "../AccountsPage.types.ts";

export function useAccountsPage(): AccountsPageViewProps {
  const { filtered } = useFilteredAnalytics();
  const setAccountIds = useAppStore((state) => state.actions.setAccountIds);
  const onSelectAccount = useCallback(
    (accountId: string) => setAccountIds([accountId]),
    [setAccountIds],
  );

  return useMemo(
    () => createAccountsPageModel(filtered, onSelectAccount),
    [filtered, onSelectAccount],
  );
}
