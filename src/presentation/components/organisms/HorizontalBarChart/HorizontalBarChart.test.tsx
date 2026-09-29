import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HorizontalBarChart } from "./HorizontalBarChart.tsx";

describe("HorizontalBarChart", () => {
  it("keeps shortened category glyphs within the reserved label column", () => {
    render(<HorizontalBarChart
      data={[{ id: "account", label: "Household daily operational account with distinguishing suffix ALPHA12345678901234567890", value: 10 }]}
      title="Long account labels"
    />);
    const label = screen.getByRole("img", { name: "Long account labels" }).querySelector("text[class*='barLabel']")!;
    expect(Number(label.getAttribute("x")) - Array.from(label.textContent ?? "").length * 11).toBeGreaterThanOrEqual(8);
    expect(label.textContent).toContain("…");
    expect(screen.getByRole("option", { hidden: true })).toHaveTextContent("Household daily operational account with distinguishing suffix ALPHA12345678901234567890");
  });

  it("keeps the whole signed currency amount inside the SVG", () => {
    const formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
    render(<HorizontalBarChart
      data={[{ id: "expense", label: "Expense", value: -13_000_000 }]}
      formatValue={formatter}
      title="Large signed amount"
    />);
    const chart = screen.getByRole("img", { name: "Large signed amount" });
    const value = chart.querySelector("text[class*='barValue']")!;
    expect(value.textContent).toBe(formatter.format(-13_000_000));
    expect(Number(value.getAttribute("x")) + Array.from(value.textContent ?? "").length * 7).toBeLessThanOrEqual(992);
  });

  it("expands a ranking and keeps all rows available for exact data and drilldown", async () => {
    const user = userEvent.setup();
    const onSelectDatum = vi.fn<(id: string) => void>();
    render(<HorizontalBarChart
      data={Array.from({ length: 30 }, (_, index) => ({ id: `c${index}`, label: `Categoría ${index}`, value: -index }))}
      onSelectDatum={onSelectDatum}
      title="Ranking"
    />);
    const chart = screen.getByRole("img", { name: "Ranking" });
    expect(chart.querySelectorAll("rect")).toHaveLength(12);
    await user.click(screen.getByText("Ver datos exactos"));
    await user.click(screen.getByRole("button", { name: "Ver movimientos: Categoría 29" }));
    expect(onSelectDatum).toHaveBeenCalledWith("c29");
    await user.selectOptions(screen.getByRole("combobox", { name: "Mostrar en Ranking" }), "0");
    expect(chart.querySelectorAll("rect")).toHaveLength(30);
  });

  it("exposes signed bar values in its exact-data table", async () => {
    const user = userEvent.setup();
    render(
      <HorizontalBarChart
        data={[{ id: "food", label: "Alimentación", value: -250 }]}
        labelHeader="Categoría"
        title="Gasto por categoría"
      />,
    );

    await user.click(screen.getByText("Ver datos exactos"));
    expect(
      screen.getByRole("columnheader", { name: "Categoría" }),
    ).toBeVisible();
    expect(screen.getByRole("row", { name: /Alimentación -250/ })).toBeVisible();
  });

  it("allows a pointer to move from a bar into its tooltip before dismissal", () => {
    render(<HorizontalBarChart
      data={[{ id: "food", label: "Alimentación", value: -250 }]}
      title="Ranking interactivo"
    />);
    const chart = screen.getByRole("img", { name: "Ranking interactivo" });
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
