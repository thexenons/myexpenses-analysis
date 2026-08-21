import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartLegend } from "./ChartLegend.tsx";

describe("ChartLegend", () => {
  it("labels series and formats optional values", () => {
    render(
      <ChartLegend
        items={[{ id: "income", label: "Ingresos", value: 125.5 }]}
      />,
    );

    expect(screen.getByText("Ingresos")).toBeVisible();
    expect(screen.getByText("125,5")).toBeVisible();
  });
});
