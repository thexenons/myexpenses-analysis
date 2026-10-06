import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createOverviewPageModel, createOverviewReviewPatch } from "../OverviewPage.helpers.ts";
import type { OverviewPageViewProps, OverviewReviewId } from "../OverviewPage.types.ts";

export function useOverviewPage(): OverviewPageViewProps | null {
  const { filtered, filters, granularity, searchPending } = useFilteredAnalytics();
  const navigate = useNavigate();
  const patchFilters = useAppStore((state) => state.actions.patchFilters);
  const onViewReview = useCallback((id: OverviewReviewId) => {
    if (searchPending || filtered === null) return;
    const patch = createOverviewReviewPatch(filters, id);
    if (patch === null) return;
    patchFilters(patch);
    void navigate({ to: "/transacciones", search: { page: 1, sort: "date", direction: "desc" } });
  }, [filtered, filters, navigate, patchFilters, searchPending]);

  return useMemo(
    () => filtered === null ? null : {
      ...createOverviewPageModel(filtered, granularity, searchPending), onViewReview,
    },
    [filtered, granularity, onViewReview, searchPending],
  );
}
