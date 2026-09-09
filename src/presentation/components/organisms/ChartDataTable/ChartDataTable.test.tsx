import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartDataTable } from "./ChartDataTable.tsx";
import { createChartCsv } from "./ChartDataTable.helpers.ts";
import * as csvHelpers from "./ChartDataTable.helpers.ts";

describe("ChartDataTable", () => {
  it("downloads only after an explicit action and includes every exact row", async () => {
    const user = userEvent.setup();
    const download = vi.spyOn(csvHelpers, "downloadChartCsv").mockImplementation(() => {});
    const columns = [{ id: "value", label: "Neto EUR" }];
    const rows = [{ id: "jan", label: "Enero", values: [-125.25] }];
    render(<ChartDataTable caption="Evolución" columns={columns} labelHeader="Periodo" rows={rows} />);
    expect(download).not.toHaveBeenCalled();
    await user.click(screen.getByText("Ver datos exactos"));
    expect(download).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Descargar CSV: Evolución" }));
    expect(download).toHaveBeenCalledWith("Periodo", columns, rows);
    download.mockRestore();
  });

  it("exports exact signed numbers and escapes formulas, commas and missing values", () => {
    expect(createChartCsv("Periodo", [{ id: "value", label: "Neto EUR" }], [
      { id: "1", label: '=HYPERLINK("url")', values: [-12.35] },
      { id: "2", label: "Casa, comida", values: [null] },
    ])).toBe('Periodo,Neto EUR\r\n"\'=HYPERLINK(""url"")",-12.35\r\n"Casa, comida",');
  });

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
    const createRows = vi.fn<() => Array<{
      id: string;
      label: string;
      values: number[];
    }>>(() => [
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
