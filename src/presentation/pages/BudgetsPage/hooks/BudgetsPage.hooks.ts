import { useCallback, useMemo, useState } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createBudgetsPageModel } from "../BudgetsPage.helpers.ts";
import type { BudgetsPageViewProps } from "../BudgetsPage.types.ts";

export function useBudgetsPage(): BudgetsPageViewProps | null {
  const { analytics, filtered, searchPending } = useFilteredAnalytics();
  const [requestedBudgetUuid, setRequestedBudgetUuid] = useState<string | null>(
    null,
  );
  const [requestedPeriodKey, setRequestedPeriodKey] = useState<string | null>(
    null,
  );
  const onBudgetChange = useCallback((uuid: string) => {
    setRequestedBudgetUuid(uuid);
    setRequestedPeriodKey(null);
  }, []);
  const onPeriodChange = useCallback((key: string) => {
    setRequestedPeriodKey(key);
  }, []);

  return useMemo(
    () =>
      analytics === null || filtered === null
        ? null
        : createBudgetsPageModel(
            analytics,
            filtered,
            requestedBudgetUuid,
            requestedPeriodKey,
            onBudgetChange,
            onPeriodChange,
            searchPending,
          ),
    [
      analytics,
      filtered,
      onBudgetChange,
      onPeriodChange,
      requestedBudgetUuid,
      requestedPeriodKey,
      searchPending,
    ],
  );
}
