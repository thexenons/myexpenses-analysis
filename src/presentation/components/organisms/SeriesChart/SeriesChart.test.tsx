import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SeriesChart } from "./SeriesChart.tsx";

describe("SeriesChart", () => {
  it("toggles series by keyboard and can recover after hiding every series", async () => {
    const user = userEvent.setup();
    render(<SeriesChart
      series={[
        { id: "income", label: "Ingresos", data: [{ label: "Enero", value: 120 }] },
        { id: "expense", label: "Gastos", data: [{ label: "Enero", value: -90 }] },
      ]}
      title="Comparación"
      variant="line"
    />);
    const incomeToggle = screen.getByRole("button", { name: "Ocultar serie: Ingresos" });
    incomeToggle.focus();
    await user.keyboard("{Enter}");
    expect(incomeToggle).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.queryByRole("columnheader", { name: "Ingresos" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Gastos" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ocultar serie: Gastos" }));
    expect(screen.getByText(/Todas las series están ocultas/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Mostrar serie: Ingresos" }));
    expect(screen.getByRole("img", { name: "Comparación" })).toBeVisible();
  });

  it("offers exact series values without adding the SVG to the tab order", async () => {
    const user = userEvent.setup();
    render(
      <SeriesChart
        series={[
          {
            id: "income",
            label: "Ingresos",
            data: [{ label: "Enero", value: 120 }],
          },
        ]}
        title="Evolución mensual"
        variant="line"
      />,
    );

    expect(screen.getByRole("img", { name: "Evolución mensual" })).not.toHaveAttribute(
      "tabindex",
    );
    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.getByRole("row", { name: /Enero 120/ })).toBeVisible();
  });

  it("caps visual markers while preserving the complete path and exact table", async () => {
    const user = userEvent.setup();
    const data = Array.from({ length: 200 }, (_, index) => ({
      label: `P${String(index).padStart(3, "0")}`,
      value: index,
    }));
    render(
      <SeriesChart
        series={[{ id: "balance", label: "Saldo", data }]}
        title="Evolución diaria"
        variant="line"
      />,
    );

    const chart = screen.getByRole("img", { name: "Evolución diaria" });
    expect(chart.querySelectorAll("circle")).toHaveLength(120);
    expect(
      chart.querySelector('path[fill="none"]')?.getAttribute("d")?.match(/[ML]/g),
    ).toHaveLength(200);

    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.getByRole("row", { name: /P199 199/ })).toBeVisible();
  });
});
