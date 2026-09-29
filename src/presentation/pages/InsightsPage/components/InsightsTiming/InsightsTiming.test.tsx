import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INSIGHTS_PAGE_PROPS } from "../../InsightsPage.test.helpers.ts";
import { InsightsTiming } from "./InsightsTiming.tsx";

describe("InsightsTiming", () => {
  it("labels value-date charts and explains incomplete value-time coverage", () => {
    render(
      <InsightsTiming
        hourSeries={INSIGHTS_PAGE_PROPS.hourSeries}
        timing={{ ...INSIGHTS_PAGE_PROPS.insights.timing, dateBasis: "value" }}
        weekdayBars={INSIGHTS_PAGE_PROPS.weekdayBars}
      />,
    );
    expect(screen.getByRole("img", { name: "Ritmo por hora de valor" })).toBeVisible();
    expect(screen.getByText(/no se inventa una hora de valor/, { selector: "p" })).toBeVisible();
    expect(screen.getByText(/valor \(operación si falta\)/, { selector: "p" })).toBeVisible();
    expect(screen.queryByText(/Los anulados permanecen/)).not.toBeInTheDocument();
  });

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

  it("agrees with one timed posting in the chart description", () => {
    render(<InsightsTiming hourSeries={INSIGHTS_PAGE_PROPS.hourSeries} timing={{ ...INSIGHTS_PAGE_PROPS.insights.timing, timedPostingCount: 1 }} weekdayBars={INSIGHTS_PAGE_PROPS.weekdayBars} />);
    expect(screen.getByText(/1 apunte conserva una hora de operación/, { selector: "p" })).toBeVisible();
  });
});
