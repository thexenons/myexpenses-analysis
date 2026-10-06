import { useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createCashFlowPageModel } from "../CashFlowPage.helpers.ts";
import type { CashFlowPageViewProps } from "../CashFlowPage.types.ts";

export function useCashFlowPage(): CashFlowPageViewProps | null {
  const { filtered, granularity } = useFilteredAnalytics();

  return useMemo(
    () =>
      filtered === null
        ? null
        : createCashFlowPageModel(filtered, granularity),
    [filtered, granularity],
  );
}
