import { useCallback, useMemo, useState } from "react";

import { analyzeBudgetPeriodComparison, type BudgetReferenceRange } from "../../../../domain/analytics/budget-period-comparison.ts";
import { analyzeBudgetPace } from "../../../../domain/analytics/budget-pace.ts";
import { budgetPeriodForDate } from "../../../../domain/analytics/budgets.ts";
import { isoDateInTimeZone } from "../../../../domain/analytics/date-periods.ts";
import { addIsoDays } from "../../../../domain/analytics/periods.ts";
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import { createBudgetsPageModel } from "../BudgetsPage.helpers.ts";
import type { BudgetsPageViewProps } from "../BudgetsPage.types.ts";

interface ReferenceSelection {
  readonly contextKey: string;
  readonly ranges: readonly BudgetReferenceRange[];
  readonly primaryKey: string | null;
}

export function useBudgetsPage(): BudgetsPageViewProps | null {
  const { analytics, filtered, searchPending } = useFilteredAnalytics();
  const [requestedBudgetUuid, setRequestedBudgetUuid] = useState<string | null>(
    null,
  );
  const [requestedPeriodKey, setRequestedPeriodKey] = useState<string | null>(
    null,
  );
  const [requestedReferences, setRequestedReferences] = useState<ReferenceSelection | null>(null);
  const onBudgetChange = useCallback((uuid: string) => {
    setRequestedBudgetUuid(uuid);
    setRequestedPeriodKey(null);
    setRequestedReferences(null);
  }, []);
  const onPeriodChange = useCallback((key: string) => {
    setRequestedPeriodKey(key);
    setRequestedReferences(null);
  }, []);

  const base = useMemo(
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
  const analysis = base?.analysis;
  const contextKey = analysis === null || analysis === undefined ? "" :
    `${analysis.budget.uuid}:${analysis.period.key}`;
  const defaultRanges = useMemo(
    () => {
      if (analysis === null || analysis === undefined || analytics?.backup === undefined || analysis.period.grouping === "NONE") return [];
      const previous = budgetPeriodForDate(
        analysis.period.grouping,
        addIsoDays(analysis.period.startDate, -1),
        analytics.backup.preferences,
      );
      return previous === null ? [] : [previous];
    },
    [analysis, analytics],
  );
  const selection = requestedReferences?.contextKey === contextKey ? requestedReferences : null;
  const selectedRanges = selection?.ranges ?? defaultRanges;
  const selectedPrimary = selection?.primaryKey ?? selectedRanges[0]?.key ?? null;
  const today = isoDateInTimeZone(new Date(), analytics?.backup?.preferences.timeZone ?? "Europe/Madrid");
  const pace = useMemo(() => {
    if (analysis == null) return null;
    try {
      return analyzeBudgetPace(analysis, today);
    } catch {
      return null;
    }
  }, [analysis, today]);
  const result = useMemo(() => {
    if (analytics === null || filtered === null || analysis === null || analysis === undefined) return null;
    try {
      return analyzeBudgetPeriodComparison(analytics, analysis, filtered.filters, {
        today, references: selectedRanges, primaryReferenceKey: selectedPrimary ?? undefined,
      });
    } catch {
      return { status: "calculation-error" } as const;
    }
  }, [analytics, filtered, analysis, today, selectedRanges, selectedPrimary]);
  const initialSelection = useCallback((): ReferenceSelection => ({
    contextKey, ranges: defaultRanges, primaryKey: defaultRanges[0]?.key ?? null,
  }), [contextKey, defaultRanges]);
  const onReferenceAdd = useCallback((range: BudgetReferenceRange) => {
    if (contextKey === "") return;
    setRequestedReferences((previousSelection) => {
      const current = previousSelection?.contextKey === contextKey ? previousSelection : initialSelection();
      if (current.ranges.some((item) => item.key === range.key)) return current;
      return { contextKey, ranges: [...current.ranges, range], primaryKey: current.primaryKey ?? range.key };
    });
  }, [contextKey, initialSelection]);
  const onReferenceRemove = useCallback((key: string) => {
    if (contextKey === "") return;
    setRequestedReferences((previousSelection) => {
      const current = previousSelection?.contextKey === contextKey ? previousSelection : initialSelection();
      const ranges = current.ranges.filter((item) => item.key !== key);
      return { contextKey, ranges,
        primaryKey: current.primaryKey === key ? ranges[0]?.key ?? null : current.primaryKey };
    });
  }, [contextKey, initialSelection]);
  const onPrimaryReferenceChange = useCallback((key: string) => {
    if (contextKey === "") return;
    setRequestedReferences((previousSelection) => {
      const current = previousSelection?.contextKey === contextKey ? previousSelection : initialSelection();
      return current.ranges.some((item) => item.key === key) ? { ...current, primaryKey: key } : current;
    });
  }, [contextKey, initialSelection]);
  return base === null ? null : {
    ...base,
    comparison: result?.status === "ready" ? result.comparison : null,
    pace,
    comparisonError: result?.status === "unsupported" ? result.reason :
      result?.status === "calculation-error" ? "No se ha podido calcular la comparación con seguridad." : null,
    onReferenceAdd, onReferenceRemove, onPrimaryReferenceChange,
  };
}
