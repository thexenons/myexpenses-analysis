import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INSIGHTS_PAGE_PROPS } from "./InsightsPage.test.helpers.ts";
import { InsightsPageView } from "./InsightsPage.view.tsx";

describe("InsightsPageView", () => {
  it("renders enriched patterns with a live deferred-search notice", () => {
    render(<InsightsPageView {...INSIGHTS_PAGE_PROPS} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Patrones y calidad" }),
    ).toBeVisible();
    expect(screen.getByText("Actualizando patrones…")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByText("Contrapartes con más actividad")).toBeVisible();
    expect(screen.getByText("Procedencia y calidad")).toBeVisible();
    expect(screen.getByText("v189")).toBeVisible();
  });
});
