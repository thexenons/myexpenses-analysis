import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DivergingBarChart } from "./DivergingBarChart.tsx";

describe("DivergingBarChart", () => {
  it("labels both sides in the exact-data alternative", async () => {
    const user = userEvent.setup();
    render(
      <DivergingBarChart
        data={[{ id: "jan", label: "Enero", leftValue: 80, rightValue: 120 }]}
        leftLabel="Gastos"
        rightLabel="Ingresos"
        title="Entradas y salidas"
      />,
    );

    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.getByRole("columnheader", { name: "Gastos" })).toBeVisible();
    expect(screen.getByRole("row", { name: /Enero 80 120/ })).toBeVisible();
  });

  it("keeps the inspected bar visible while the pointer enters its tooltip", () => {
    render(<DivergingBarChart
      data={[{ id: "jan", label: "Enero", leftValue: 80, rightValue: 120 }]}
      leftLabel="Gastos"
      rightLabel="Ingresos"
      title="Entradas y salidas"
    />);
    const chart = screen.getByRole("img", { name: "Entradas y salidas" });
    const bar = chart.querySelector("g[class*='barGroup']");
    expect(bar).not.toBeNull();
    fireEvent.pointerEnter(bar!);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.pointerLeave(chart);
    fireEvent.pointerEnter(tooltip);
    expect(tooltip).toBeInTheDocument();
    fireEvent.pointerLeave(tooltip);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
