import { useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createCashFlowPageModel } from "../CashFlowPage.helpers.ts";
import type { CashFlowPageViewProps } from "../CashFlowPage.types.ts";

export function useCashFlowPage(): CashFlowPageViewProps | null {
  const { filtered, granularity } = useFilteredAnalytics();
  const selectedStatuses = useAppStore((state) => state.filters.statuses);

  return useMemo(
    () =>
      filtered === null
        ? null
        : createCashFlowPageModel(filtered, granularity, selectedStatuses),
    [filtered, granularity, selectedStatuses],
  );
}
