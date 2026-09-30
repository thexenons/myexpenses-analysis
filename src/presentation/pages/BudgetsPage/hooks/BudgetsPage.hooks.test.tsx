import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultFilterState } from "../../../../domain/analytics/filters.ts";
import type { FilterState } from "../../../../domain/analytics/types.ts";
import { useBudgetsPage } from "./BudgetsPage.hooks.ts";

const { filteredState, compareSpy, modelSpy } = vi.hoisted(() => ({
  filteredState: { current: null as unknown },
  compareSpy: vi.fn<(...args: unknown[]) => unknown>(),
  modelSpy: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("../../../hooks/filtered-analytics/filtered-analytics.hooks.ts", () => ({
  useFilteredAnalytics: () => filteredState.current,
}));
vi.mock("../../../../domain/analytics/budget-period-comparison.ts", () => ({
  analyzeBudgetPeriodComparison: (...args: unknown[]) => compareSpy(...args),
}));
vi.mock("../BudgetsPage.helpers.ts", () => ({
  createBudgetsPageModel: (...args: unknown[]) => modelSpy(...args),
}));

function requestedComparison() {
  return compareSpy.mock.lastCall?.[3] as {
    references: readonly { key: string }[];
    primaryReferenceKey?: string;
  };
}

describe("useBudgetsPage references", () => {
  it("retains references across perspective changes and resets on budget or target changes", () => {
    const analytics = { backup: { preferences: {
      homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 1, weekStart: 1, includeTransfers: true,
    } } };
    let filters: FilterState = createDefaultFilterState();
    filteredState.current = { analytics, filtered: { filters }, searchPending: false };
    modelSpy.mockImplementation((_analytics, _filtered, budgetUuid, periodKey, onBudgetChange, onPeriodChange) => {
      const key = (periodKey as string | null) ?? "MONTH:2026:7";
      const month = key === "MONTH:2026:6" ? "07" : "08";
      return {
        analysis: { budget: { uuid: (budgetUuid as string | null) ?? "first" }, period: {
          key, grouping: "MONTH", startDate: `2026-${month}-01`, endDate: `2026-${month}-31`,
        } },
        onBudgetChange, onPeriodChange,
      };
    });
    compareSpy.mockImplementation((_analytics, _analysis, _filters, options) => ({
      status: "ready", comparison: { references: (options as { references: unknown[] }).references },
    }));

    const { result, rerender } = renderHook(() => useBudgetsPage());
    expect(requestedComparison().references.map((range) => range.key)).toEqual(["MONTH:2026:6"]);
    act(() => result.current!.onReferenceAdd!({ key: "MONTH:2026:5", label: "Junio", startDate: "2026-06-01", endDate: "2026-06-30" }));
    expect(requestedComparison().references.map((range) => range.key)).toEqual(["MONTH:2026:6", "MONTH:2026:5"]);
    act(() => result.current!.onPrimaryReferenceChange!("MONTH:2026:5"));
    expect(requestedComparison().primaryReferenceKey).toBe("MONTH:2026:5");
    filters = { ...filters, scope: "debtsOnly" };
    filteredState.current = { analytics, filtered: { filters }, searchPending: false };
    rerender();
    expect(requestedComparison().references.map((range) => range.key)).toEqual(["MONTH:2026:6", "MONTH:2026:5"]);
    expect(requestedComparison().primaryReferenceKey).toBe("MONTH:2026:5");
    act(() => result.current!.onReferenceRemove!("MONTH:2026:5"));
    expect(requestedComparison().primaryReferenceKey).toBe("MONTH:2026:6");
    act(() => result.current!.onReferenceRemove!("MONTH:2026:6"));
    expect(requestedComparison().references).toEqual([]);
    expect(requestedComparison().primaryReferenceKey).toBeUndefined();
    act(() => result.current!.onPeriodChange("MONTH:2026:6"));
    expect(requestedComparison().references.map((range) => range.key)).toEqual(["MONTH:2026:5"]);
    act(() => result.current!.onBudgetChange("second"));
    expect(requestedComparison().references.map((range) => range.key)).toEqual(["MONTH:2026:6"]);
  });
});
