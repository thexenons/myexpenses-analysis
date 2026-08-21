import { describe, expect, it } from "vitest"

import { buildSeriesChartModel, getSeriesPaths } from "./chart.helpers"

describe("buildSeriesChartModel", () => {
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
