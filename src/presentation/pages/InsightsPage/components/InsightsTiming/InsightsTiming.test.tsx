import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INSIGHTS_PAGE_PROPS } from "../../InsightsPage.test.helpers.ts";
import { InsightsTiming } from "./InsightsTiming.tsx";

describe("InsightsTiming", () => {
  it("exposes hour and weekday charts with accessible names", () => {
    render(
      <InsightsTiming
        hourSeries={INSIGHTS_PAGE_PROPS.hourSeries}
        timing={INSIGHTS_PAGE_PROPS.insights.timing}
        weekdayBars={INSIGHTS_PAGE_PROPS.weekdayBars}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Ritmo por hora local" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Distribución semanal" }),
    ).toBeVisible();
    expect(screen.getByText(/cobertura/u)).toBeVisible();
  });
});
