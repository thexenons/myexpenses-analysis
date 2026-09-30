import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../../domain/analytics/filters.ts";
import type { BackupBudgetV1 } from "../../../../domain/analytics/backup-dataset.types.ts";
import type { AnalyticsDataset, FilterState, NormalizedPosting } from "../../../../domain/analytics/types.ts";
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

function historicalDataset(): AnalyticsDataset {
  const budget: BackupBudgetV1 = {
    uuid: "budget", sourceId: 1, title: "Synthetic", description: "", grouping: "MONTH",
    accountUuid: null, currency: "EUR", startDate: null, endDate: null,
    isDefault: true, filter: null, aggregateNeutral: false,
    allocations: [{ categoryUuid: "expense", year: 2020, period: 7, amountMinor: 10_000,
      rolloverPreviousMinor: 0, rolloverNextMinor: 0, oneTime: false }],
  };
  const posting = (id: string, date: `${number}-${number}-${number}`, amount: number, tags: string[]): NormalizedPosting => ({
    id, transactionId: id, sourceTransactionId: id,
    accountId: "cash", accountLabel: "Cash", accountType: "DEFAULT",
    currency: "EUR", fractionDigits: 2, date,
    amountNativeMinor: amount, amountEurMinor: amount,
    exchangeRateToEur: 1, exchangeRateSource: "identity",
    categoryPath: ["Expense"], categoryType: "EXPENSE", bucket: "expense",
    status: "RECONCILED", isVoid: false, linked: false, tags,
    splitIndex: null, splitCount: null,
  });
  const rows = [
    posting("coverage-start", "2020-07-01", 0, []),
    posting("historical-refund", "2020-07-12", 20_000, ["history"]),
    posting("current-spend", "2020-08-12", -(Number.MAX_SAFE_INTEGER - 10_000), ["current"]),
    posting("coverage-end", "2020-08-31", 0, []),
  ];
  return {
    currency: "EUR", accounts: [{ id: "cash", label: "Cash", currency: "EUR", type: "DEFAULT", fractionDigits: 2,
      exchangeRateMode: "IDENTITY", openingBalanceNativeMinor: 0, openingBalanceEurMinor: 0,
      currentBalanceNativeMinor: 0, historicalBalanceEurMinor: 0, valuationBalanceEurMinor: 0,
      postingCount: rows.length, activePostingCount: rows.length }],
    postings: rows, minDate: "2020-07-01", maxDate: "2020-08-31",
    source: { accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } }, categories: {} },
    backup: {
      source: { format: "myexpenses-backup", schemaVersion: 189, backupSha256: "a".repeat(64), databaseSha256: "b".repeat(64) },
      preferences: { homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 1, weekStart: 1, includeTransfers: true },
      currencies: [{ sourceId: 1, code: "EUR", fractionDigits: 2, label: "Euro", symbol: "€", commodityType: "FIAT" }],
      accounts: [{ uuid: "cash", sourceId: 1, label: "Cash", description: null, currency: "EUR", fractionDigits: 2,
        nativeType: "CASH", scope: "DEFAULT", parentUuid: null, openingNativeMinor: 0, openingHomeMinor: 0,
        exchangeRateMode: "IDENTITY", exchangeRateToHome: 1,
        flags: { sourceId: 0, visible: true, excludedFromTotals: false, includedInAll: true, isAsset: true, supportsReconciliation: false } }],
      categories: [{ uuid: "expense", sourceId: 1, name: "Expense", type: "EXPENSE", parentUuid: null,
        path: ["Expense"], color: null, icon: null }],
      payees: [], paymentMethods: [], tags: [], budgets: [budget],
    },
  };
}

describe("useBudgetsPage references", () => {
  it("keeps a safe current budget available when a real historical delta exceeds safe minor units, then recovers", async () => {
    const comparisonModule = await vi.importActual<typeof import("../../../../domain/analytics/budget-period-comparison.ts")>(
      "../../../../domain/analytics/budget-period-comparison.ts",
    );
    const pageModule = await vi.importActual<typeof import("../BudgetsPage.helpers.ts")>("../BudgetsPage.helpers.ts");
    compareSpy.mockImplementation((...args) => comparisonModule.analyzeBudgetPeriodComparison(
      ...(args as Parameters<typeof comparisonModule.analyzeBudgetPeriodComparison>),
    ));
    modelSpy.mockImplementation((...args) => pageModule.createBudgetsPageModel(
      ...(args as Parameters<typeof pageModule.createBudgetsPageModel>),
    ));
    const analytics = historicalDataset();
    let filters = createDefaultFilterState();
    filteredState.current = { analytics, filtered: applyFilters(analytics, filters), searchPending: false };

    const { result, rerender } = renderHook(() => useBudgetsPage());
    expect(result.current?.analysis?.global.consumedMinor).toBe(Number.MAX_SAFE_INTEGER - 10_000);
    expect(result.current?.comparison).toBeNull();
    expect(result.current?.comparisonError).toBe("No se ha podido calcular la comparación con seguridad.");

    filters = { ...filters, tags: ["current"] };
    filteredState.current = { analytics, filtered: applyFilters(analytics, filters), searchPending: false };
    rerender();
    expect(result.current?.analysis?.global.consumedMinor).toBe(Number.MAX_SAFE_INTEGER - 10_000);
    expect(result.current?.comparisonError).toBeNull();
    expect(result.current?.comparison?.references[0]?.consumedMinor).toBe(0);
  });

  it("keeps unsupported comparison reasons distinct from arithmetic failures", () => {
    const analytics = { backup: { preferences: {
      homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 1, weekStart: 1, includeTransfers: true,
    } } };
    filteredState.current = { analytics, filtered: { filters: createDefaultFilterState() }, searchPending: false };
    modelSpy.mockReturnValue({ analysis: { budget: { uuid: "budget" }, period: {
      key: "MONTH:2026:7", grouping: "MONTH", startDate: "2026-08-01", endDate: "2026-08-31",
    } } });
    compareSpy.mockReturnValue({ status: "unsupported", reason: "Synthetic unsupported result" });
    const { result } = renderHook(() => useBudgetsPage());
    expect(result.current?.analysis).not.toBeNull();
    expect(result.current?.comparison).toBeNull();
    expect(result.current?.comparisonError).toBe("Synthetic unsupported result");
  });

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
