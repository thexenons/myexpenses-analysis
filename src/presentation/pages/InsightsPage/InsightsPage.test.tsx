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
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf("Métodos de pago")).toBeGreaterThan(headings.indexOf("Contrapartes con más actividad"));
    expect(headings.indexOf("Métodos de pago")).toBeLessThan(headings.indexOf("Operación frente a fecha valor"));
    expect(screen.getByText("Procedencia y calidad")).toBeVisible();
    expect(screen.getByText("v189")).toBeVisible();
  });
});
