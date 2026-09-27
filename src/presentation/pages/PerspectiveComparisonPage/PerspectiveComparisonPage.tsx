import { useMemo } from "react";

import { useFilteredAnalytics } from "../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createPerspectiveComparisonPageModel } from "./PerspectiveComparisonPage.helpers.ts";
import { PerspectiveComparisonPageView } from "./PerspectiveComparisonPage.view.tsx";

export function PerspectiveComparisonPage() {
  const { analytics, filtered, searchPending } = useFilteredAnalytics();
  const model = useMemo(
    () => analytics === null || filtered === null
      ? null
      : createPerspectiveComparisonPageModel(analytics, filtered.filters),
    [analytics, filtered],
  );

  return model === null ? null : (
    <PerspectiveComparisonPageView {...model} searchPending={searchPending} />
  );
}
