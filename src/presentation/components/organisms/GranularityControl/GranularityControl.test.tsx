import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../../../application/ports/dataset-repository.ts";
import { createAppStore } from "../../../../application/store/app-store/app-store.ts";
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts";
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts";
import { GranularityControl } from "./GranularityControl.tsx";

describe("GranularityControl", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps every compact dropdown option synchronized with desktop radios without changing dates", async () => {
    const user = userEvent.setup();
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    store.getState().actions.setDatePeriod("month", { from: "2026-04-01", to: "2026-04-30" });
    render(<AppStoreProvider store={store}><GranularityControl compact /></AppStoreProvider>);
    const select = screen.getByRole("combobox", { name: "Granularidad de estadísticas y gráficas" });
    expect([...select.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "auto", "day", "week", "month", "year",
    ]);
    for (const setting of ["day", "week", "month", "year", "auto"]) {
      // oxlint-disable-next-line no-await-in-loop -- Verify each selection against its matching store update.
      await user.selectOptions(select, setting);
      expect(store.getState().granularity).toBe(setting);
      expect(select).toHaveValue(setting);
      expect(screen.getByRole("radio", { checked: true })).toHaveAttribute("value", setting);
    }
    expect(store.getState().filters.dateRange).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    await user.click(screen.getByRole("radio", { name: "Día" }));
    expect(select).toHaveValue("day");
    expect(screen.queryByText(/Resolución/)).toBeNull();
  });

  it("keeps the expanded drawer control segmented without a duplicate dropdown", () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    render(<AppStoreProvider store={store}><GranularityControl /></AppStoreProvider>);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("reports automatic granularity using the same date basis as the charts", () => {
    const store = createAppStore({ load: vi.fn<DatasetRepository["load"]>() }, window.localStorage);
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "first", sourceTransactionUuid: "first", date: "2025-01-02", amount: -10, category: ["Gastos"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "last", sourceTransactionUuid: "last", date: "2025-01-03", amount: -10, category: ["Gastos"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const analytics = structuredClone(initial);
    for (const posting of analytics.postings) {
      Object.assign(posting, { valueDate: posting.transactionId === "first" ? "2024-12-31" : "2026-01-01" });
    }
    store.setState({ analytics, loadPhase: "ready" });
    render(<AppStoreProvider store={store}><GranularityControl /></AppStoreProvider>);

    expect(screen.getByText("Resolución automática actual: día.")).toBeVisible();
    act(() => store.getState().actions.patchFilters({ dateBasis: "value" }));
    expect(screen.getByText("Resolución automática actual: año.")).toBeVisible();
  });

  it("keeps automatic and manual chart granularity independent from dates", async () => {
    const user = userEvent.setup();
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>() },
      window.localStorage,
    );
    store.getState().actions.setDatePeriod("month", {
      from: "2026-04-01",
      to: "2026-04-30",
    });
    render(
      <AppStoreProvider store={store}>
        <GranularityControl />
      </AppStoreProvider>,
    );

    expect(screen.getByText("Resolución automática actual: semana.")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Día" }));
    expect(store.getState().granularity).toBe("day");
    expect(screen.getByText("Resolución manual: día.")).toBeVisible();
  });
});
