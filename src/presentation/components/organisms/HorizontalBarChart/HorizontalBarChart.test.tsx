import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HorizontalBarChart } from "./HorizontalBarChart.tsx";

describe("HorizontalBarChart", () => {
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
});
