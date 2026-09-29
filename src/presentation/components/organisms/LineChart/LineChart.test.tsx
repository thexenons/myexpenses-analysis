import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineChart } from "./LineChart.tsx";

describe("LineChart", () => {
  it("keeps the complete currency tick inside its SVG", () => {
    const formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
    render(<LineChart
      formatValue={formatter}
      series={[{ id: "flow", label: "Flow", data: [{ label: "January", value: -13_000_000 }] }]}
      title="Large signed amounts"
    />);
    const chart = screen.getByRole("img", { name: "Large signed amounts" });
    const ticks = [...chart.querySelectorAll("text[text-anchor='end']")];
    expect(ticks.some((tick) => tick.textContent?.includes("-"))).toBe(true);
    for (const tick of ticks) {
      expect(Number(tick.getAttribute("x"))).toBeGreaterThanOrEqual(Array.from(tick.textContent ?? "").length * 7 + 8);
    }
  });

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
