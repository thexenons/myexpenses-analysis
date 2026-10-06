import { act, render, screen, waitFor } from "@testing-library/react";
import { flushSync } from "react-dom";
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
  const { filtered, filters, granularity, searchPending } = useFilteredAnalytics();
  return (
    <output data-ids={filtered?.activePostings.map(({ transactionId }) => transactionId).join(",")} data-testid="probe" data-count={filtered?.postings.length} data-source-count={filtered?.source.postings.length} data-source-max-date={filtered?.source.maxDate} data-statuses={filters.statuses.join(",")} data-budget-statuses={filtered?.filters.statuses.join(",")}>
      {searchPending ? "pending" : "ready"}:{filtered?.filters.search ?? "missing"}:
      {granularity}
    </output>
  );
}

describe("useFilteredAnalytics", () => {
  it("shares the same derivation across consumers and invalidates changed effective filters", () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
    applyFiltersSpy.mockClear();

    render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /><FilteredAnalyticsProbe /></AppStoreProvider>);
    expect(applyFiltersSpy).toHaveBeenCalledOnce();

    act(() => store.getState().actions.patchFilters({ scope: "debtsOnly" }));
    expect(applyFiltersSpy).toHaveBeenCalledTimes(2);
    expect(applyFiltersSpy.mock.lastCall?.[1].scope).toBe("debtsOnly");

    act(() => store.getState().actions.setStatuses(["VOID"]));
    expect(applyFiltersSpy).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId("probe")[0]).toHaveAttribute("data-budget-statuses", "");
  });

  it("does not reuse a derivation for a new dataset after locking", async () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
    applyFiltersSpy.mockClear();

    render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /><FilteredAnalyticsProbe /></AppStoreProvider>);
    expect(applyFiltersSpy).toHaveBeenCalledOnce();

    await act(async () => { await store.getState().actions.lock(); });
    expect(screen.getAllByTestId("probe")[0]).toHaveTextContent("missing");
    expect(applyFiltersSpy).toHaveBeenCalledOnce();

    const nextAnalytics: AnalyticsDataset = { ...EMPTY_ANALYTICS, maxDate: "2026-09-01" };
    act(() => store.setState({ analytics: nextAnalytics, loadPhase: "ready" }));
    expect(applyFiltersSpy).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId("probe")[0]).toHaveAttribute("data-source-max-date", "2026-09-01");
  });

  it("shares deferred search derivations without applying urgent search values", async () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
    render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /><FilteredAnalyticsProbe /></AppStoreProvider>);
    applyFiltersSpy.mockClear();

    act(() => {
      flushSync(() => store.getState().actions.patchFilters({
        search: "mercado", commentSearch: "note", referenceSearch: "ref",
      }));
      expect(screen.getAllByTestId("probe")[0]).toHaveTextContent("pending::");
      expect(applyFiltersSpy).not.toHaveBeenCalled();
    });
    await waitFor(() => expect(screen.getAllByTestId("probe")[0]).toHaveTextContent("ready:mercado"));
    expect(applyFiltersSpy).toHaveBeenCalledOnce();
    expect(applyFiltersSpy.mock.calls[0]?.[1]).toMatchObject({
      search: "mercado", commentSearch: "note", referenceSearch: "ref",
    });
  });

  it("projects only active rows and ignores stale status selections without mutating the source", () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Food: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "cleared", sourceTransactionUuid: "cleared", date: "2025-01-02", amount: -10, category: ["Food"], sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
        { uuid: "void", sourceTransactionUuid: "void", date: "2025-01-03", amount: -10, category: ["Food"], sourceStatus: "VOID", splitIndex: null, splitCount: null },
      ] }],
    });
    store.setState({ analytics: initial, loadPhase: "ready" });
    store.getState().actions.setStatuses(["VOID"]);
    render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /></AppStoreProvider>);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-source-count", "2");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-statuses", "");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-budget-statuses", "");
    expect(initial.postings).toHaveLength(2);
    expect(store.getState().filters.statuses).toEqual(["VOID"]);
    act(() => store.getState().actions.setStatuses(["CLEARED"]));
    expect(screen.getByTestId("probe")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-budget-statuses", "");
  });
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

  it("projects every new facet into the deferred analytics calculation", async () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
    render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /></AppStoreProvider>);
    applyFiltersSpy.mockClear();
    const facets = {
      payeeKeys: ['["source",1]'], paymentMethodKeys: ['["missing"]'],
      categoryTypes: ["NEUTRAL" as const], currencies: ["GBP" as const],
      minAmountEurMinor: 0, maxAmountEurMinor: 500,
      commentSearch: "café", referenceSearch: "ref",
    };
    act(() => store.getState().actions.patchFilters(facets));
    await waitFor(() => expect(applyFiltersSpy).toHaveBeenCalled());
    expect(applyFiltersSpy.mock.lastCall?.[1]).toMatchObject(facets);
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

it("forwards category mode and invalidates shared results on mode-only changes", () => {
  const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
  store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
  store.getState().actions.setCategoryPrefixes([["Gastos"]]);
  applyFiltersSpy.mockClear();
  render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /></AppStoreProvider>);
  expect(applyFiltersSpy.mock.lastCall?.[1].categoryMode).toBe("include");
  act(() => store.getState().actions.patchFilters({ categoryMode: "exclude" }));
  expect(applyFiltersSpy).toHaveBeenCalledTimes(2);
  expect(applyFiltersSpy.mock.lastCall?.[1].categoryMode).toBe("exclude");
});

it("forwards owning account mode and invalidates mode-only shared results", () => {
  const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
  store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
  applyFiltersSpy.mockClear();
  render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /></AppStoreProvider>);
  expect(applyFiltersSpy.mock.lastCall?.[1].accountMode).toBe("include");
  act(() => store.getState().actions.patchFilters({ accountMode: "exclude" }));
  expect(applyFiltersSpy).toHaveBeenCalledTimes(2);
  expect(applyFiltersSpy.mock.lastCall?.[1].accountMode).toBe("exclude");
});

it("forwards tag mode and invalidates shared results on mode-only changes", () => {
  const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
  store.setState({ analytics: EMPTY_ANALYTICS, loadPhase: "ready" });
  applyFiltersSpy.mockClear();
  render(<AppStoreProvider store={store}><FilteredAnalyticsProbe /></AppStoreProvider>);
  expect(applyFiltersSpy.mock.lastCall?.[1].tagMode).toBe("include");
  act(() => store.getState().actions.patchFilters({ tagMode: "exclude" }));
  expect(applyFiltersSpy).toHaveBeenCalledTimes(2);
  expect(applyFiltersSpy.mock.lastCall?.[1].tagMode).toBe("exclude");
});


it("shares active status-neutral derivations across consumers and ignores legacy status changes", () => {
  const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
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
  store.setState({ analytics, loadPhase: "ready" });
  store.getState().actions.setStatuses(["UNRECONCILED"]);
  applyFiltersSpy.mockClear();
  const view = render(<AppStoreProvider store={store}>
    <FilteredAnalyticsProbe /><FilteredAnalyticsProbe /><FilteredAnalyticsProbe />
  </AppStoreProvider>);
  const [statistics, table, duplicate] = screen.getAllByTestId("probe");
  expect(statistics).toHaveAttribute("data-ids", "UNRECONCILED,CLEARED");
  expect(table).toHaveAttribute("data-ids", "UNRECONCILED,CLEARED");
  expect(duplicate).toHaveAttribute("data-ids", "UNRECONCILED,CLEARED");
  expect(applyFiltersSpy).toHaveBeenCalledOnce();
  act(() => store.getState().actions.setStatuses(["CLEARED"]));
  expect(table).toHaveAttribute("data-ids", "UNRECONCILED,CLEARED");
  expect(statistics).toHaveAttribute("data-ids", "UNRECONCILED,CLEARED");
  expect(applyFiltersSpy).toHaveBeenCalledOnce();
  act(() => store.getState().actions.setStatuses(["VOID"]));
  expect(table).toHaveAttribute("data-count", "2");
  expect(statistics).toHaveAttribute("data-count", "2");
  expect(analytics.postings).toHaveLength(3);
  view.rerender(<AppStoreProvider store={store}><FilteredAnalyticsProbe /><FilteredAnalyticsProbe /></AppStoreProvider>);
  expect(screen.getAllByTestId("probe")[1]).toHaveAttribute("data-count", "2");
});
