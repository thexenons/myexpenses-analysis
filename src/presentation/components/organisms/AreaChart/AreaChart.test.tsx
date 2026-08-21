import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AreaChart } from "./AreaChart.tsx";

describe("AreaChart", () => {
  it("renders an area bounded by the zero baseline", () => {
    render(
      <AreaChart
        series={[
          {
            id: "flow",
            label: "Flujo",
            data: [
              { label: "Enero", value: 20 },
              { label: "Febrero", value: 30 },
            ],
          },
        ]}
        title="Área mensual"
      />,
    );

    const chart = screen.getByRole("img", { name: "Área mensual" });
    expect(chart.querySelector("path[fill]:not([fill='none'])")).toBeInTheDocument();
  });
});
