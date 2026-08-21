import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineChart } from "./LineChart.tsx";

describe("LineChart", () => {
  it("renders one plotted point for every finite value", () => {
    render(
      <LineChart
        series={[
          {
            id: "flow",
            label: "Flujo",
            data: [{ label: "Enero", value: 20 }],
          },
        ]}
        title="Flujo mensual"
      />,
    );

    const chart = screen.getByRole("img", { name: "Flujo mensual" });
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
  });
});
