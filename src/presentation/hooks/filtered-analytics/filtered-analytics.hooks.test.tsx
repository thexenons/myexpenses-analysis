import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../../application/ports/dataset-repository.ts";
import type {
  AnalyticsDataset,
  FilterState,
} from "../../../domain/analytics/types.ts";
import { createAppStore } from "../../../application/store/app-store/app-store.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import { AppStoreProvider } from "../../providers/AppStoreProvider/index.ts";
import { useFilteredAnalytics } from "./filtered-analytics.hooks.ts";

const { applyFiltersSpy } = vi.hoisted(() => ({
  applyFiltersSpy: vi.fn<
    (dataset: AnalyticsDataset, filters: FilterState) => void
  >(),
}));

vi.mock("../../../domain/analytics/filters.ts", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../domain/analytics/filters.ts")
  >();
  return {
    ...actual,
    applyFilters: (...parameters: Parameters<typeof actual.applyFilters>) => {
      applyFiltersSpy(...parameters);
      return actual.applyFilters(...parameters);
    },
  };
});

const EMPTY_ANALYTICS: AnalyticsDataset = {
  accounts: [],
  currency: "EUR",
  maxDate: null,
  minDate: null,
  postings: [],
  source: {
    accounts: { accounts: {}, version: 2 },
    categories: {},
  },
};

function FilteredAnalyticsProbe() {
  const { filtered, granularity, searchPending } = useFilteredAnalytics();
  return (
    <output data-testid="probe">
      {searchPending ? "pending" : "ready"}:{filtered?.filters.search ?? "missing"}:
      {granularity}
    </output>
  );
}

describe("useFilteredAnalytics", () => {
  it("derives automatic granularity from the selected value-date history", () => {
    window.localStorage.clear();
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Banco", type: "DEFAULT" } } },
      categories: { Hogar: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Banco", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "first", sourceTransactionUuid: "first", date: "2025-01-02", amount: -10, category: ["Hogar"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "last", sourceTransactionUuid: "last", date: "2025-01-03", amount: -10, category: ["Hogar"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const analytics = { ...initial, postings: initial.postings.map((row) => Object.assign({}, row, { valueDate: row.transactionId === "first" ? "2024-12-31" as const : "2026-01-01" as const })) };
    store.setState({ analytics, loadPhase: "ready" });
    render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /></AppStoreProvider>);
    expect(screen.getByTestId("probe")).toHaveTextContent("ready::day");
    act(() => store.getState().actions.patchFilters({ dateBasis: "value" }));
    expect(screen.getByTestId("probe")).toHaveTextContent("ready::year");
  });

  it("does not recompute analytics in the urgent render of a search update", async () => {
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>() },
      window.localStorage,
    );
    store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
    render(
      <AppStoreProvider store={store}>
        <FilteredAnalyticsProbe />
      </AppStoreProvider>,
    );
    applyFiltersSpy.mockClear();

    act(() => store.getState().actions.patchFilters({ search: "mercado" }));

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("ready:mercado"),
    );
    expect(applyFiltersSpy).toHaveBeenCalledOnce();
    expect(applyFiltersSpy.mock.calls[0]?.[1].search).toBe("mercado");
  });

  it("resolves automatic granularity before page models consume it", () => {
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>() },
      window.localStorage,
    );
    store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
    store.getState().actions.setDatePeriod("year", {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    render(
      <AppStoreProvider store={store}>
        <FilteredAnalyticsProbe />
      </AppStoreProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("ready::month");
    act(() => store.getState().actions.setGranularity("week"));
    expect(screen.getByTestId("probe")).toHaveTextContent("ready::week");
  });
});
