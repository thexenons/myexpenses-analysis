import { useCallback, useEffect, useId, useMemo, useState } from "react"

import {
  buildDivergingBarChartModel,
  buildHorizontalBarChartModel,
  buildSeriesChartModel,
  seriesColor,
  CHART_WIDTH,
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

export function useChartWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(CHART_WIDTH);
  useEffect(() => {
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured !== undefined && measured > 0) setWidth(Math.max(220, Math.round(measured)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { element, setElement, width, compact: width < 600 };
}

export function useChartSeriesVisibility(series: readonly ChartSeries[]) {
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<ReadonlySet<string>>(() => new Set());
  const onToggleSeries = useCallback((id: string) => {
    setHiddenSeriesIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const coloredSeries = useMemo(() => series.map((item, index) => ({
    ...item,
    color: seriesColor(item.color, index),
  })), [series]);
  const visibleSeries = useMemo(
    () => coloredSeries.filter((item) => !hiddenSeriesIds.has(item.id)),
    [coloredSeries, hiddenSeriesIds],
  );
  return { coloredSeries, hiddenSeriesIds, onToggleSeries, visibleSeries };
}

export function useChartRanking(data: readonly ChartBarDatum[], initialLimit: number) {
  const [limit, setLimit] = useState(initialLimit);
  const visibleData = useMemo(() => limit === 0 ? data : data.slice(0, limit), [data, limit]);
  return { limit, setLimit, visibleData };
}

export function useChartIds(prefix: string): ChartIds {
  const generatedId = useId().replaceAll(":", "")
  return {
    descriptionId: `${prefix}-${generatedId}-description`,
    titleId: `${prefix}-${generatedId}-title`,
  }
}

export function useSeriesChartModel(
  series: ReadonlyArray<ChartSeries>,
  width = CHART_WIDTH,
): SeriesChartModel {
  return useMemo(() => buildSeriesChartModel(series, width), [series, width])
}

export function useHorizontalBarChartModel(
  data: ReadonlyArray<ChartBarDatum>,
  width = CHART_WIDTH,
): HorizontalBarChartModel {
  return useMemo(() => buildHorizontalBarChartModel(data, width), [data, width])
}

export function useDivergingBarChartModel(
  data: ReadonlyArray<DivergingBarDatum>,
  leftColor: string | undefined,
  leftLabel: string,
  rightColor: string | undefined,
  rightLabel: string,
  width = CHART_WIDTH,
): DivergingBarChartModel {
  return useMemo(
    () =>
      buildDivergingBarChartModel(
        data,
        leftColor,
        leftLabel,
        rightColor,
        rightLabel,
        width,
      ),
    [data, leftColor, leftLabel, rightColor, rightLabel, width],
  )
}
