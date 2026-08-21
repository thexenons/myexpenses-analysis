import type {
  ChartColorStyle,
  ChartSeries,
  DivergingBarChartModel,
  DivergingBarDatum,
  HorizontalBarChartModel,
  ChartBarDatum,
  Scale,
  SeriesChartModel,
  SeriesPaths,
} from "./chart.types"

export const CHART_WIDTH = 1_000
export const SERIES_CHART_HEIGHT = 360
export const SERIES_MARGIN = {
  top: 20,
  right: 26,
  bottom: 58,
  left: 82,
} as const
export const BAR_MARGIN = { top: 20, right: 84, bottom: 54, left: 230 } as const
export const BAR_ROW_HEIGHT = 42
const DEFAULT_TICK_COUNT = 5
const PERIOD_LABEL_PATTERN = /^(?:\d{4}|\d{4}-\d{2}|\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})$/
const DEFAULT_SERIES_COLORS = [
  "#286a4c",
  "#a33f36",
  "#35698b",
  "#bd7d2f",
  "#6d5f91",
  "#43817b",
  "#8b6945",
  "#697b34",
] as const

export function identityLabel(label: string): string {
  return label
}

export function seriesColor(color: string | undefined, index: number): string {
  return color ?? DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length]!
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1

  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const factor = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1
  return factor * magnitude
}

export function createScale(
  values: ReadonlyArray<number>,
  tickCount = DEFAULT_TICK_COUNT,
): Scale {
  let minimum = 0
  let maximum = 0

  for (const value of values) {
    if (!Number.isFinite(value)) continue
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }

  if (minimum === maximum) {
    const padding = Math.abs(minimum) || 1
    minimum -= padding
    maximum += padding
  }

  const step = niceStep((maximum - minimum) / Math.max(1, tickCount - 1))
  const niceMinimum = Math.floor(minimum / step) * step
  const niceMaximum = Math.ceil(maximum / step) * step
  const ticks: number[] = []

  for (
    let tick = niceMinimum, index = 0;
    tick <= niceMaximum + step / 2 && index < 20;
    tick += step, index += 1
  ) {
    ticks.push(Number(tick.toPrecision(12)))
  }

  return { min: niceMinimum, max: niceMaximum, ticks }
}

export function scaleLinear(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): number {
  const ratio = (value - domainMin) / (domainMax - domainMin || 1)
  return rangeMin + ratio * (rangeMax - rangeMin)
}

function selectedLabelIndexes(
  length: number,
  maximumLabels = 7,
): ReadonlySet<number> {
  if (length <= maximumLabels) {
    return new Set(Array.from({ length }, (_, index) => index))
  }

  const lastIndex = length - 1
  const step = lastIndex / (maximumLabels - 1)
  const indexes = new Set<number>()

  for (let index = 0; index < maximumLabels; index += 1) {
    indexes.add(Math.round(index * step))
  }

  return indexes
}

export function chartColorStyle(
  property: string,
  color: string | undefined,
): ChartColorStyle {
  if (!color) return undefined
  return { [property]: color } as ChartColorStyle
}

export function chartDescription(
  description: string | undefined,
  title: string,
): string {
  return description ?? `Representación gráfica de ${title}.`
}

export function buildSeriesChartModel(
  series: ReadonlyArray<ChartSeries>,
): SeriesChartModel {
  const labels: string[] = []
  const labelSet = new Set<string>()
  const values: number[] = []

  for (const item of series) {
    for (const point of item.data) {
      if (!Number.isFinite(point.value)) continue
      values.push(point.value)
      if (!labelSet.has(point.label)) {
        labelSet.add(point.label)
        labels.push(point.label)
      }
    }
  }

  if (labels.every((label) => PERIOD_LABEL_PATTERN.test(label))) {
    labels.sort()
  }
  const labelIndexes = new Map(
    labels.map((label, index) => [label, index] as const),
  )

  const scale = createScale(values)
  const plotLeft = SERIES_MARGIN.left
  const plotRight = CHART_WIDTH - SERIES_MARGIN.right
  const plotTop = SERIES_MARGIN.top
  const plotBottom = SERIES_CHART_HEIGHT - SERIES_MARGIN.bottom
  const zeroY = scaleLinear(0, scale.min, scale.max, plotBottom, plotTop)
  const plottedSeries = series.map((item) => {
    const coordinates = item.data.flatMap((point) => {
      if (!Number.isFinite(point.value)) return []
      const labelIndex = labelIndexes.get(point.label)
      if (labelIndex === undefined) return []
      const x =
        labels.length === 1
          ? (plotLeft + plotRight) / 2
          : scaleLinear(labelIndex, 0, labels.length - 1, plotLeft, plotRight)
      const y = scaleLinear(point.value, scale.min, scale.max, plotBottom, plotTop)
      return [{ point, x, y }]
    })

    return { coordinates, series: item }
  })

  return {
    empty: values.length === 0 || labels.length === 0,
    labels,
    legendItems: series.map((item) => ({
      color: item.color,
      id: item.id,
      label: item.label,
    })),
    plotBottom,
    plotLeft,
    plotRight,
    plotTop,
    plottedSeries,
    scale,
    visibleLabels: selectedLabelIndexes(labels.length),
    zeroY,
  }
}

export function getSeriesPaths(
  coordinates: SeriesChartModel["plottedSeries"][number]["coordinates"],
  zeroY: number,
): SeriesPaths {
  const linePath = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ")
  const firstCoordinate = coordinates[0]
  const lastCoordinate = coordinates.at(-1)
  const areaPath =
    firstCoordinate && lastCoordinate
      ? `${linePath} L${lastCoordinate.x},${zeroY} L${firstCoordinate.x},${zeroY} Z`
      : ""

  return { areaPath, linePath }
}

export function buildHorizontalBarChartModel(
  data: ReadonlyArray<ChartBarDatum>,
): HorizontalBarChartModel {
  const validData = data.filter((datum) => Number.isFinite(datum.value))
  const scale = createScale(validData.map((datum) => datum.value))
  const chartHeight = Math.max(
    250,
    BAR_MARGIN.top + BAR_MARGIN.bottom + validData.length * BAR_ROW_HEIGHT,
  )
  const plotLeft = BAR_MARGIN.left
  const plotRight = CHART_WIDTH - BAR_MARGIN.right
  const plotBottom = chartHeight - BAR_MARGIN.bottom
  const zeroX = scaleLinear(0, scale.min, scale.max, plotLeft, plotRight)

  return {
    bars: validData.map((datum, index) => {
      const centerY = BAR_MARGIN.top + index * BAR_ROW_HEIGHT + BAR_ROW_HEIGHT / 2
      const valueX = scaleLinear(
        datum.value,
        scale.min,
        scale.max,
        plotLeft,
        plotRight,
      )

      return {
        barWidth: Math.max(1, Math.abs(valueX - zeroX)),
        barX: Math.min(zeroX, valueX),
        centerY,
        color: seriesColor(datum.color, index),
        datum,
      }
    }),
    chartHeight,
    plotBottom,
    plotLeft,
    plotRight,
    scale,
    zeroX,
  }
}

export function buildDivergingBarChartModel(
  data: ReadonlyArray<DivergingBarDatum>,
  leftColor: string | undefined,
  leftLabel: string,
  rightColor: string | undefined,
  rightLabel: string,
): DivergingBarChartModel {
  const validData = data.filter(
    (datum) =>
      Number.isFinite(datum.leftValue) && Number.isFinite(datum.rightValue),
  )
  let maximum = 0

  for (const datum of validData) {
    maximum = Math.max(
      maximum,
      Math.abs(datum.leftValue),
      Math.abs(datum.rightValue),
    )
  }

  const extent = maximum || 1
  const chartHeight = Math.max(
    250,
    BAR_MARGIN.top + BAR_MARGIN.bottom + validData.length * BAR_ROW_HEIGHT,
  )
  const centerX = (BAR_MARGIN.left + CHART_WIDTH - BAR_MARGIN.right) / 2
  const halfWidth = (CHART_WIDTH - BAR_MARGIN.right - BAR_MARGIN.left) / 2
  const tickScale = createScale([-extent, extent])
  const scaleExtent = Math.max(
    Math.abs(tickScale.min),
    Math.abs(tickScale.max),
  )
  const resolvedLeftColor = leftColor ?? DEFAULT_SERIES_COLORS[1]
  const resolvedRightColor = rightColor ?? DEFAULT_SERIES_COLORS[0]

  return {
    bars: validData.map((datum, index) => ({
      centerY: BAR_MARGIN.top + index * BAR_ROW_HEIGHT + BAR_ROW_HEIGHT / 2,
      datum,
      leftWidth: (Math.abs(datum.leftValue) / scaleExtent) * halfWidth,
      rightWidth: (Math.abs(datum.rightValue) / scaleExtent) * halfWidth,
    })),
    centerX,
    chartHeight,
    legendItems: [
      { color: resolvedLeftColor, id: "left", label: leftLabel },
      { color: resolvedRightColor, id: "right", label: rightLabel },
    ],
    plotBottom: chartHeight - BAR_MARGIN.bottom,
    resolvedLeftColor,
    resolvedRightColor,
    tickScale,
  }
}
