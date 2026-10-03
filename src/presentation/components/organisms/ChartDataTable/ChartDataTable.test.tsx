import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartDataTable } from "./ChartDataTable.tsx";
import { createChartCsv } from "./ChartDataTable.helpers.ts";
import * as csvHelpers from "./ChartDataTable.helpers.ts";
import { exactEuroDecimalFromMinor, formatExactEuroMinor, formatPeriodLabel } from "../../../utils/format.ts";

describe("ChartDataTable", () => {
  it("distinguishes shortened dates across years without changing drilldowns or CSV rows", async () => {
    const user = userEvent.setup();
    const onSelectRow = vi.fn<(id: string) => void>();
    const download = vi.spyOn(csvHelpers, "downloadChartCsv").mockImplementation(() => {});
    const columns = [{ id: "value", label: "Neto EUR" }];
    const rows = [
      { id: "first-day", label: "2024-01-01", values: [-125.25] },
      { id: "next-year", label: "2025-01-01", values: [150] },
    ];
    render(<ChartDataTable caption="Evolución diaria" columns={columns} formatLabel={formatPeriodLabel} labelHeader="Periodo" onSelectRow={onSelectRow} rows={rows} />);
    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.getByRole("rowheader", { name: "01 ene · 2024-01-01" })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "01 ene · 2025-01-01" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ver movimientos: 01 ene · 2025-01-01" }));
    expect(onSelectRow).toHaveBeenCalledWith("next-year");
    await user.click(screen.getByRole("button", { name: "Descargar CSV: Evolución diaria" }));
    expect(download).toHaveBeenCalledWith("Periodo", columns, rows);
  });

  it("retains original labels in read-only exact tables too", async () => {
    const user = userEvent.setup();
    render(<ChartDataTable caption="Día exacto" columns={[]} formatLabel={formatPeriodLabel} labelHeader="Periodo" rows={[{ id: "day", label: "2024-01-01", values: [] }]} />);
    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.getByRole("rowheader", { name: "01 ene · 2024-01-01" })).toBeVisible();
  });

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


it("renders and exports validated signed minor metadata without losing cents or CSV escaping", async () => {
  const user = userEvent.setup();
  const rows = [
    { id: "positive", label: "=formula", values: [80000000000000.02], valuesEurMinor: [8000000000000001] },
    { id: "negative", label: "Negative", values: [-90071992547409.9], valuesEurMinor: [-Number.MAX_SAFE_INTEGER] },
    { id: "small", label: "Small", values: [-0.01, 0], valuesEurMinor: [-1, 0] },
    { id: "missing", label: "Missing", values: [null, 12], valuesEurMinor: [1, null] },
    { id: "invalid", label: "Invalid", values: [3, 4, 5, 6], valuesEurMinor: [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1] },
  ];
  const columns = [{ id: "a", label: "Amount" }, { id: "b", label: "Other" }];
  render(<ChartDataTable caption="Minor units" columns={columns} labelHeader="Period" rows={rows} />);
  await user.click(screen.getByText("Ver datos exactos"));
  expect(screen.getByRole("row", { name: /80\.000\.000\.000\.000,01/ })).toBeVisible();
  expect(screen.getByRole("row", { name: /-90\.071\.992\.547\.409,91/ })).toBeVisible();
  expect(screen.getByRole("row", { name: /Small -0,01.*0,00/ })).toBeVisible();
  expect(createChartCsv("Period", columns, rows)).toBe([
    "Period,Amount,Other", "'=formula,80000000000000.01", "Negative,-90071992547409.91",
    "Small,-0.01,0.00", "Missing,,12", "Invalid,3,4,5,6",
  ].join("\r\n"));
});


it("formats exact signed minor boundaries and rejects invalid or missing metadata", () => {
  for (const [minor, decimal, currency] of [
    [Number.MAX_SAFE_INTEGER, "90071992547409.91", "90.071.992.547.409,91"],
    [-Number.MAX_SAFE_INTEGER, "-90071992547409.91", "-90.071.992.547.409,91"],
    [-1, "-0.01", "-0,01"], [0, "0.00", "0,00"], [-0, "0.00", "0,00"],
  ] as const) {
    expect(exactEuroDecimalFromMinor(minor)).toBe(decimal);
    expect(formatExactEuroMinor(minor)).toBe(`${currency}\u00a0€`);
  }
  for (const invalid of [null, undefined, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(exactEuroDecimalFromMinor(invalid)).toBeNull();
    expect(formatExactEuroMinor(invalid)).toBeNull();
  }
});
