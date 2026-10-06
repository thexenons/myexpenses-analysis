import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts";
import type { AnalyticsDataset, NormalizedPosting } from "../../../../domain/analytics/types.ts";
import { useTransactionsPage } from "./TransactionsPage.hooks.ts";

const { downloadSpy, searchState, navigateSpy, filteredState, filteredSpy } = vi.hoisted(() => ({
  downloadSpy: vi.fn<(postings: readonly NormalizedPosting[], dataset?: AnalyticsDataset) => void>(),
  searchState: { direction: "desc" as const, page: 2, sort: "date" as const },
  navigateSpy: vi.fn<(...args: unknown[]) => void>(),
  filteredState: { current: null as unknown },
  filteredSpy: vi.fn<() => void>(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
  useSearch: () => searchState,
}));
vi.mock("../../../hooks/filtered-analytics/filtered-analytics.hooks.ts", () => ({
  useFilteredAnalytics: () => {
    filteredSpy();
    return { filtered: filteredState.current, searchPending: false };
  },
}));
vi.mock("../TransactionsPage.helpers.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../TransactionsPage.helpers.ts")>(),
  downloadPostingsCsv: downloadSpy,
}));

describe("useTransactionsPage", () => {
  it("uses active postings for pagination, result count and full CSV export", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Food: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        ...Array.from({ length: 27 }, (_, index) => ({
          uuid: `active-${index}`, sourceTransactionUuid: `active-${index}`, date: "2026-01-01" as const, amount: -1,
          category: ["Food"], sourceStatus: "CLEARED" as const, splitIndex: null, splitCount: null,
        })),
        { uuid: "void", sourceTransactionUuid: "void", date: "2026-01-02" as const, amount: -1, category: ["Food"], sourceStatus: "VOID" as const, splitIndex: null, splitCount: null },
      ] }],
    });
    filteredState.current = applyFilters(analytics, createDefaultFilterState());
    const { result } = renderHook(() => useTransactionsPage());
    act(() => result.current.onPageSizeChange?.(25));
    expect(filteredSpy).toHaveBeenLastCalledWith();
    expect(result.current.resultCount).toBe(27);
    expect(result.current.pageCount).toBe(2);
    expect(result.current.postings).toHaveLength(2);
    expect(result.current.postings.every((posting) => !posting.isVoid)).toBe(true);
    act(() => result.current.onDownload());
    const downloaded = downloadSpy.mock.lastCall?.[0] as typeof analytics.postings;
    expect(downloaded).toHaveLength(27);
    expect(downloaded.every((posting) => !posting.isVoid)).toBe(true);
    expect(analytics.postings).toHaveLength(28);
  });
});


it("ignores legacy status selections in active transaction rows and CSV", () => {
  const analytics = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: { Food: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions:
      (["UNRECONCILED", "CLEARED", "VOID"] as const).map((status) => ({
        uuid: status, sourceTransactionUuid: status, date: "2026-01-01", amount: -1,
        category: ["Food"], sourceStatus: status, splitIndex: null, splitCount: null,
      })),
    }],
  });
  filteredState.current = applyFilters(analytics, { ...createDefaultFilterState(), statuses: ["UNRECONCILED"] });
  const { result } = renderHook(() => useTransactionsPage());
  expect(filteredSpy).toHaveBeenLastCalledWith();
  expect(result.current.resultCount).toBe(2);
  expect(result.current.postings.map(({ transactionId }) => transactionId)).toEqual(["UNRECONCILED", "CLEARED"]);
  act(() => result.current.onDownload());
  expect(downloadSpy.mock.lastCall?.[0].map(({ transactionId }) => transactionId)).toEqual(["UNRECONCILED", "CLEARED"]);
});
