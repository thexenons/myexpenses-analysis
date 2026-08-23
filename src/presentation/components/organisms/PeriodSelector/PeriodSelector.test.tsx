import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../../../application/ports/dataset-repository.ts";
import { createAppStore } from "../../../../application/store/app-store/app-store.ts";
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts";
import { PeriodSelector } from "./PeriodSelector.tsx";

describe("PeriodSelector", () => {
  beforeEach(() => window.localStorage.clear());

  it("selects a complete month through the shared global date filter", async () => {
    const user = userEvent.setup();
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>() },
      window.localStorage,
    );
    render(
      <AppStoreProvider store={store}>
        <PeriodSelector />
      </AppStoreProvider>,
    );

    await user.click(screen.getByRole("radio", { name: "Mes" }));
    const month = screen.getByLabelText("Mes seleccionado");
    fireEvent.change(month, { target: { value: "2026-04" } });

    expect(store.getState().filters).toMatchObject({
      periodMode: "month",
      dateRange: { from: "2026-04-01", to: "2026-04-30" },
    });
    expect(screen.getByText(/1 abr 2026.*30 abr 2026/iu)).toBeVisible();

    await user.click(screen.getByRole("radio", { name: "Todo" }));
    expect(store.getState().filters).toMatchObject({
      periodMode: "all",
      dateRange: { from: null, to: null },
    });
  });

  it("keeps a custom range ordered when either boundary crosses the other", async () => {
    const user = userEvent.setup();
    const store = createAppStore(
      { load: vi.fn<DatasetRepository["load"]>() },
      window.localStorage,
    );
    store.getState().actions.setDatePeriod("custom", {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    render(
      <AppStoreProvider store={store}>
        <PeriodSelector />
      </AppStoreProvider>,
    );

    const from = screen.getByLabelText("Desde");
    await user.clear(from);
    await user.type(from, "2026-02-10");
    expect(store.getState().filters.dateRange).toEqual({
      from: "2026-02-10",
      to: "2026-02-10",
    });
  });
});
