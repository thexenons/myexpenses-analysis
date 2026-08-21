import { useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createDebtsPageModel } from "../DebtsPage.helpers.ts";
import type { DebtsPageViewProps } from "../DebtsPage.types.ts";

export function useDebtsPage(): DebtsPageViewProps | null {
  const { filtered, granularity } = useFilteredAnalytics();

  return useMemo(
    () =>
      filtered === null
        ? null
        : createDebtsPageModel(filtered, granularity),
    [filtered, granularity],
  );
}
