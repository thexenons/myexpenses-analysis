import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../../application/ports/dataset-repository.ts";
import type {
  AnalyticsDataset,
  FilterState,
} from "../../../domain/analytics/types.ts";
import { createAppStore } from "../../../application/store/app-store/app-store.ts";
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
  const { filtered, searchPending } = useFilteredAnalytics();
  return (
    <output data-testid="probe">
      {searchPending ? "pending" : "ready"}:{filtered?.filters.search ?? "missing"}
    </output>
  );
}

describe("useFilteredAnalytics", () => {
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
});
