import { useMemo } from "react";

import { useFilteredAnalytics } from "../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createPerspectiveComparisonModel } from "./PerspectiveComparisonPage.helpers.ts";
import { PerspectiveComparisonPageView } from "./PerspectiveComparisonPage.view.tsx";

export function PerspectiveComparisonPage() {
  const { analytics, filtered, searchPending } = useFilteredAnalytics();
  const rows = useMemo(
    () => analytics === null || filtered === null
      ? null
      : createPerspectiveComparisonModel(analytics, filtered.filters),
    [analytics, filtered],
  );

  return rows === null ? null : (
    <PerspectiveComparisonPageView rows={rows} searchPending={searchPending} />
  );
}
