import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { INSIGHTS_PAGE_PROPS } from "../../InsightsPage.test.helpers.ts";
import { InsightsQuality } from "./InsightsQuality.tsx";

describe("InsightsQuality", () => {
  it("renders effective value-date coverage and exact lags", async () => {
    const user = userEvent.setup();
    render(
      <InsightsQuality
        lagBars={INSIGHTS_PAGE_PROPS.lagBars}
        valueDates={INSIGHTS_PAGE_PROPS.insights.valueDates}
      />,
    );

    expect(screen.getByText("Operación frente a fecha valor")).toBeVisible();
    await user.click(screen.getByText("Ver desfases exactos"));
    expect(
      screen.getByRole("table", {
        name: "Distribución exacta del desfase de fecha valor",
      }),
    ).toBeVisible();
  });

});
