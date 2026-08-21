import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartDataTable } from "./ChartDataTable.tsx";

describe("ChartDataTable", () => {
  it("reveals an exact, labelled table on demand", async () => {
    const user = userEvent.setup();
    render(
      <ChartDataTable
        caption="Datos exactos de la evolución"
        columns={[{ id: "income", label: "Ingresos" }]}
        labelHeader="Periodo"
        rows={[{ id: "jan", label: "Enero", values: [125.5] }]}
      />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByText("Ver datos exactos"));
    const table = screen.getByRole("table", {
      name: "Datos exactos de la evolución",
    });
    expect(within(table).getByRole("row", { name: /Enero 125,5/ })).toBeVisible();
  });

  it("does not build lazy rows until the exact-data table is opened", async () => {
    const user = userEvent.setup();
    const createRows = vi.fn(() => [
      { id: "jan", label: "Enero", values: [125.5] },
    ]);
    render(
      <ChartDataTable
        caption="Datos exactos de la evolución"
        columns={[{ id: "income", label: "Ingresos" }]}
        labelHeader="Periodo"
        rows={createRows}
      />,
    );

    expect(createRows).not.toHaveBeenCalled();
    await user.click(screen.getByText("Ver datos exactos"));
    expect(createRows).toHaveBeenCalledOnce();
    expect(screen.getByRole("row", { name: /Enero 125,5/ })).toBeVisible();
  });
});
