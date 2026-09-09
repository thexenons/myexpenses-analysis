import { describe, expect, it } from "vitest"

import { buildDivergingBarChartModel, buildHorizontalBarChartModel, buildSeriesChartModel, compactChartLabel, getSeriesPaths } from "./chart.helpers"

describe("buildSeriesChartModel", () => {
  it("keeps all mobile bars, axes and series inside the available width", () => {
    const horizontal = buildHorizontalBarChartModel([
      { id: "out", label: "Salidas", value: -250 },
      { id: "in", label: "Entradas", value: 100 },
    ], 280);
    expect(horizontal.plotLeft).toBe(18);
    expect(horizontal.plotRight).toBe(262);
    for (const bar of horizontal.bars) {
      expect(bar.barX).toBeGreaterThanOrEqual(horizontal.plotLeft);
      expect(bar.barX + bar.barWidth).toBeLessThanOrEqual(horizontal.plotRight);
    }
    const diverging = buildDivergingBarChartModel([{ id: "jan", label: "Enero", leftValue: 100, rightValue: 250 }], undefined, "Salidas", undefined, "Entradas", 280);
    expect(diverging.centerX).toBe(140);
    expect(diverging.centerX - diverging.bars[0]!.leftWidth).toBeGreaterThanOrEqual(diverging.plotLeft);
    expect(diverging.centerX + diverging.bars[0]!.rightWidth).toBeLessThanOrEqual(diverging.plotRight);
    const line = buildSeriesChartModel([{ id: "cash", label: "Flujo", data: Array.from({ length: 12 }, (_, index) => ({ label: `2026-${String(index + 1).padStart(2, "0")}`, value: index })) }], 280);
    expect(line.visibleLabels.size).toBe(3);
    expect(line.plottedSeries[0]?.coordinates.at(-1)?.x).toBeLessThan(280);
  });

  it("keeps zero bars empty and long labels recognizable without clipping the SVG", () => {
    const model = buildHorizontalBarChartModel([{ id: "zero", label: "Sin movimiento", value: 0 }]);
    expect(model.bars[0]?.barWidth).toBe(0);
    const fullLabel = "Gastos del hogar › Limpieza › Productos de limpieza";
    expect(compactChartLabel(fullLabel)).toHaveLength(32);
    expect(compactChartLabel(fullLabel)).toContain("…");
    expect(compactChartLabel(fullLabel).endsWith("ductos de limpieza")).toBe(true);
  });

  it("orders misaligned temporal series before indexing the axis and paths", () => {
    const model = buildSeriesChartModel([
      {
        id: "expenses",
        label: "Gastos",
        data: [
          { label: "2024-01", value: 10 },
          { label: "2024-02", value: 20 },
        ],
      },
      {
        id: "income",
        label: "Ingresos",
        data: [
          { label: "2023-12", value: 5 },
          { label: "2024-01", value: 15 },
        ],
      },
    ])

    expect(model.labels).toEqual(["2023-12", "2024-01", "2024-02"])
    for (const { coordinates } of model.plottedSeries) {
      expect(coordinates.map(({ x }) => x)).toEqual(
        coordinates.map(({ x }) => x).toSorted((left, right) => left - right),
      )
      expect(getSeriesPaths(coordinates, model.zeroY).linePath).toMatch(/^M/)
    }
  })

  it("preserves insertion order for generic labels", () => {
    const model = buildSeriesChartModel([
      {
        id: "generic",
        label: "Genérica",
        data: [
          { label: "Marzo", value: 1 },
          { label: "Enero", value: 2 },
        ],
      },
    ])

    expect(model.labels).toEqual(["Marzo", "Enero"])
  })
})
