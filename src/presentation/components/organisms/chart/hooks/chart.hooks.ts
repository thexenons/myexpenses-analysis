import { useId, useMemo } from "react"

import {
  buildDivergingBarChartModel,
  buildHorizontalBarChartModel,
  buildSeriesChartModel,
} from "../chart.helpers"
import type {
  ChartBarDatum,
  ChartIds,
  ChartSeries,
  DivergingBarChartModel,
  DivergingBarDatum,
  HorizontalBarChartModel,
  SeriesChartModel,
} from "../chart.types"

export function useChartIds(prefix: string): ChartIds {
  const generatedId = useId().replaceAll(":", "")
  return {
    descriptionId: `${prefix}-${generatedId}-description`,
    titleId: `${prefix}-${generatedId}-title`,
  }
}

export function useSeriesChartModel(
  series: ReadonlyArray<ChartSeries>,
): SeriesChartModel {
  return useMemo(() => buildSeriesChartModel(series), [series])
}

export function useHorizontalBarChartModel(
  data: ReadonlyArray<ChartBarDatum>,
): HorizontalBarChartModel {
  return useMemo(() => buildHorizontalBarChartModel(data), [data])
}

export function useDivergingBarChartModel(
  data: ReadonlyArray<DivergingBarDatum>,
  leftColor: string | undefined,
  leftLabel: string,
  rightColor: string | undefined,
  rightLabel: string,
): DivergingBarChartModel {
  return useMemo(
    () =>
      buildDivergingBarChartModel(
        data,
        leftColor,
        leftLabel,
        rightColor,
        rightLabel,
      ),
    [data, leftColor, leftLabel, rightColor, rightLabel],
  )
}
