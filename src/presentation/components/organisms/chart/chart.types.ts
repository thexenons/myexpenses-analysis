import type { CSSProperties, ReactNode } from "react"

/** Shared chart primitives and render models. */
export interface ChartPoint {
  id?: string
  label: string
  tooltip?: string
  value: number
}

export interface ChartSeries {
  color?: string
  data: ReadonlyArray<ChartPoint>
  id: string
  label: string
}

export interface ChartLegendItem {
  color?: string
  id: string
  label: ReactNode
  value?: number
}

export interface ChartBarDatum {
  color?: string
  id: string
  label: string
  tooltip?: string
  value: number
}

export interface DivergingBarDatum {
  id: string
  label: string
  leftTooltip?: string
  leftValue: number
  rightTooltip?: string
  rightValue: number
}

export interface Scale {
  max: number
  min: number
  ticks: ReadonlyArray<number>
}

export interface ChartCoordinate {
  point: ChartPoint
  x: number
  y: number
}

export interface PlottedSeries {
  coordinates: ReadonlyArray<ChartCoordinate>
  series: ChartSeries
}

export interface SeriesChartModel {
  empty: boolean
  labels: ReadonlyArray<string>
  legendItems: ReadonlyArray<ChartLegendItem>
  plotBottom: number
  plotLeft: number
  plotRight: number
  plotTop: number
  plottedSeries: ReadonlyArray<PlottedSeries>
  scale: Scale
  visibleLabels: ReadonlySet<number>
  zeroY: number
}

export interface HorizontalBarModelItem {
  barWidth: number
  barX: number
  centerY: number
  color: string
  datum: ChartBarDatum
}

export interface HorizontalBarChartModel {
  bars: ReadonlyArray<HorizontalBarModelItem>
  chartHeight: number
  plotBottom: number
  plotLeft: number
  plotRight: number
  scale: Scale
  zeroX: number
}

export interface DivergingBarModelItem {
  centerY: number
  datum: DivergingBarDatum
  leftWidth: number
  rightWidth: number
}

export interface DivergingBarChartModel {
  bars: ReadonlyArray<DivergingBarModelItem>
  centerX: number
  chartHeight: number
  legendItems: ReadonlyArray<ChartLegendItem>
  plotBottom: number
  resolvedLeftColor: string
  resolvedRightColor: string
  tickScale: Scale
}

export interface ChartIds {
  descriptionId: string
  titleId: string
}

export interface SeriesPaths {
  areaPath: string
  linePath: string
}

export type ChartColorStyle = CSSProperties | undefined
