import { useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createInsightsPageModel } from "../InsightsPage.helpers.ts";
import type { InsightsPageViewProps } from "../InsightsPage.types.ts";

export function useInsightsPage(): InsightsPageViewProps | null {
  const { filtered, searchPending } = useFilteredAnalytics();

  return useMemo(
    () =>
      filtered === null
        ? null
        : createInsightsPageModel(filtered, searchPending),
    [filtered, searchPending],
  );
}
