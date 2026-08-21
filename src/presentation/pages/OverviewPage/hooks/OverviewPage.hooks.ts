import { useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createOverviewPageModel } from "../OverviewPage.helpers.ts";
import type { OverviewPageViewProps } from "../OverviewPage.types.ts";

export function useOverviewPage(): OverviewPageViewProps | null {
  const { filtered, granularity, searchPending } = useFilteredAnalytics();

  return useMemo(
    () =>
      filtered === null
        ? null
        : createOverviewPageModel(filtered, granularity, searchPending),
    [filtered, granularity, searchPending],
  );
}
