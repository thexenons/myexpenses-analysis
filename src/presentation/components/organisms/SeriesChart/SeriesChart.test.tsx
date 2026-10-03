import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SeriesChart } from "./SeriesChart.tsx";

describe("SeriesChart", () => {
  it("matches an overflowing SVG's physical and logical width without shrinking exact labels", () => {
    const label = "1".repeat(150);
    render(<SeriesChart formatValue={() => label} series={[{ id: "flow", label: "Flow", data: [{ label: "January", value: 1 }] }]} title="Wide exact labels" variant="line" />);
    const region = screen.getByRole("region", { name: "Gráfico desplazable: Wide exact labels" });
    const chart = screen.getByRole("img", { name: "Wide exact labels" });
    const width = Number(chart.getAttribute("viewBox")!.split(" ")[2]);
    expect(width).toBeGreaterThan(1000);
    expect(chart).toHaveStyle({ minWidth: `${width}px` });
    expect(chart.parentElement).toBe(region);
    expect(chart.querySelector("text")!.textContent).toBe(label);
  });

  it("uses formatted period text when pruning overlapping axis labels", () => {
    const props = {
      formatValue: () => "1".repeat(150),
      series: [{ id: "flow", label: "Flow", data: [
        { label: "2026-W01", value: -1 }, { label: "2026-W02", value: 0 }, { label: "2026-W03", value: 1 },
      ] }],
      title: "Narrow weekly plot",
      variant: "line" as const,
    };
    const { rerender } = render(<SeriesChart {...props} />);
    const chart = screen.getByRole("img", { name: props.title });
    expect(chart.querySelectorAll("text[class*='xAxisLabel']")).toHaveLength(1);
    rerender(<SeriesChart {...props} formatLabel={(label) => label.slice(-2)} />);
    expect(chart.querySelectorAll("text[class*='xAxisLabel']")).toHaveLength(3);
    expect(chart.querySelectorAll("circle")).toHaveLength(3);
  });

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

  it("keeps a pointer tooltip open while moving from SVG to its scrollable overlay", () => {
    render(<SeriesChart
      series={[{ id: "cash", label: "Flujo", data: [{ label: "Enero", value: 15 }] }]}
      title="Evolución del flujo"
      variant="line"
    />);
    const chart = screen.getByRole("img", { name: "Evolución del flujo" });
    const marker = chart.querySelector("circle");
    expect(marker).not.toBeNull();
    fireEvent.pointerEnter(marker!);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.pointerLeave(chart);
    fireEvent.pointerEnter(tooltip);
    expect(tooltip).toBeInTheDocument();
    expect(getComputedStyle(tooltip).pointerEvents).toBe("auto");
    expect(getComputedStyle(tooltip).overflow).toBe("auto");
    fireEvent.pointerLeave(tooltip);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});


it("keeps exact minor metadata aligned with visible series, missing values and hidden-series recovery", async () => {
  const user = userEvent.setup();
  const series = [
    { id: "a", label: "First", data: [{ label: "Jan", value: 80000000000000.02, valueEurMinor: 8000000000000001 }, { label: "Feb", value: 0, valueEurMinor: 0 }] },
    { id: "b", label: "Second", data: [{ label: "Jan", value: -0.01, valueEurMinor: -1 }] },
  ];
  render(<SeriesChart series={series} title="Exact series" variant="line" />);
  await user.click(screen.getByText("Ver datos exactos"));
  expect(screen.getByRole("row", { name: /Jan 80\.000\.000\.000\.000,01.*-0,01/ })).toBeVisible();
  expect(screen.getByRole("row", { name: /Feb 0,00.*—/ })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Ocultar serie: First" }));
  expect(screen.getByRole("row", { name: /Jan -0,01/ })).toBeVisible();
  expect(screen.queryByRole("columnheader", { name: "First" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Ocultar serie: Second" }));
  expect(screen.getByText(/Todas las series están ocultas/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Mostrar serie: First" }));
  await user.click(screen.getByText("Ver datos exactos"));
  expect(screen.getByRole("row", { name: /Jan 80\.000\.000\.000\.000,01/ })).toBeVisible();
});


it("shows exact safe boundary and zero minor amounts in the inspector while retaining missing points", async () => {
  const user = userEvent.setup();
  render(<SeriesChart title="Exact inspection" variant="line" series={[
    { id: "safe", label: "Safe", data: [{ label: "Jan", value: 80000000000000.02, valueEurMinor: 8000000000000001 }] },
    { id: "zero", label: "Zero", data: [{ label: "Jan", value: 0, valueEurMinor: 0 }] },
    { id: "missing", label: "Missing", data: [{ label: "Jan", value: NaN, valueEurMinor: 1 }] },
  ]} />);
  await user.click(screen.getByText("Consultar un punto"));
  const readout = screen.getByRole("region", { name: "Valores de Exact inspection" });
  expect(readout).toHaveTextContent(/Safe80\.000\.000\.000\.000,01\s*€/);
  expect(readout).toHaveTextContent(/Zero0,00\s*€/);
  expect(readout).toHaveTextContent("MissingSin dato");
  expect(screen.getByRole("img", { name: "Exact inspection" }).querySelector("circle title")).toHaveTextContent(/80\.000\.000\.000\.000,01/);
});
