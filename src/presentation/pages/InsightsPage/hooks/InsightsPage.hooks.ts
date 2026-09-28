import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { useAppStore } from "../../../providers/AppStoreProvider/index.ts";
import { createIdentityDrilldownPatch, createInsightsPageModel } from "../InsightsPage.helpers.ts";
import type { InsightsPageViewProps } from "../InsightsPage.types.ts";

export function useInsightsPage(): InsightsPageViewProps | null {
  const { filtered, filters, searchPending } = useFilteredAnalytics();
  const navigate = useNavigate();
  const patchFilters = useAppStore((state) => state.actions.patchFilters);
  const onViewIdentity = useCallback((kind: "payee" | "method", identityKey: string) => {
    if (searchPending) return;
    patchFilters(createIdentityDrilldownPatch(filters, kind, identityKey));
    void navigate({ to: "/transacciones", search: { page: 1, sort: "date", direction: "desc" } });
  }, [filters, navigate, patchFilters, searchPending]);
  const onViewPayee = useCallback((identityKey: string) => onViewIdentity("payee", identityKey), [onViewIdentity]);
  const onViewMethod = useCallback((identityKey: string) => onViewIdentity("method", identityKey), [onViewIdentity]);

  return useMemo(
    () => {
      if (filtered === null) return null;
      const model = createInsightsPageModel(filtered, searchPending);
      return model === null ? null : { ...model, onViewPayee, onViewMethod };
    },
    [filtered, searchPending, onViewPayee, onViewMethod],
  );
}
