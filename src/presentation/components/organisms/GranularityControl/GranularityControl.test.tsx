import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../../../application/ports/dataset-repository.ts";
import { createAppStore } from "../../../../application/store/app-store/app-store.ts";
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts";
import { GranularityControl } from "./GranularityControl.tsx";

describe("GranularityControl", () => {
  beforeEach(() => window.localStorage.clear());

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
