import { useCallback } from "react";

import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import { ChartDataTable } from "../ChartDataTable/index.ts";
import { ChartFrame } from "../ChartFrame/index.ts";
import { ChartLegend } from "../ChartLegend/index.ts";
import {
  CHART_WIDTH,
  SERIES_CHART_HEIGHT,
  chartColorStyle,
  chartDescription,
  getSeriesPaths,
  identityLabel,
  scaleLinear,
  seriesColor,
} from "../chart/chart.helpers.ts";
import styles from "../chart/chart.module.css";
import {
  useChartIds,
  useSeriesChartModel,
} from "../chart/hooks/chart.hooks.ts";
import type { SeriesChartProps } from "./SeriesChart.types.ts";

const MAX_POINT_MARKERS_PER_SERIES = 120;

function selectPointMarkers<Coordinate>(
  coordinates: readonly Coordinate[],
): readonly Coordinate[] {
  if (coordinates.length <= MAX_POINT_MARKERS_PER_SERIES) return coordinates;

  const lastIndex = coordinates.length - 1;
  return Array.from({ length: MAX_POINT_MARKERS_PER_SERIES }, (_, index) => {
    const coordinateIndex = Math.round(
      (index * lastIndex) / (MAX_POINT_MARKERS_PER_SERIES - 1),
    );
    return coordinates[coordinateIndex]!;
  });
}

export function SeriesChart({
  className,
  description,
  emptyMessage = "No hay datos para representar.",
  formatLabel = identityLabel,
  formatValue,
  ref,
  series,
  title,
  tooltipFormatter,
  variant,
}: SeriesChartProps) {
  const { descriptionId, titleId } = useChartIds("series-chart");
  const {
    empty,
    labels,
    legendItems,
    plotBottom,
    plotLeft,
    plotRight,
    plotTop,
    plottedSeries,
    scale,
    visibleLabels,
    zeroY,
  } = useSeriesChartModel(series);
  const createDataTableRows = useCallback(() => {
    const valuesBySeriesAndLabel = series.map((item) => {
      const valuesByLabel = new Map<string, number | null>();
      for (const point of item.data) {
        if (!valuesByLabel.has(point.label)) {
          valuesByLabel.set(
            point.label,
            Number.isFinite(point.value) ? point.value : null,
          );
        }
      }
      return valuesByLabel;
    });

    return labels.map((label) => ({
      id: label,
      label,
      values: valuesBySeriesAndLabel.map(
        (valuesByLabel) => valuesByLabel.get(label) ?? null,
      ),
    }));
  }, [labels, series]);

  return (
    <ChartFrame
      className={cx(
        variant === "line" ? styles.lineChart : styles.areaChart,
        className,
      )}
      dataTable={
        <ChartDataTable
          caption={`Datos exactos de ${title}`}
          columns={series.map((item) => ({ id: item.id, label: item.label }))}
          formatLabel={formatLabel}
          formatValue={formatValue}
          labelHeader="Periodo"
          rows={createDataTableRows}
        />
      }
      description={description}
      empty={empty}
      emptyMessage={emptyMessage}
      legend={<ChartLegend items={legendItems} />}
      ref={ref}
      title={title}
    >
      <svg
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={styles.svg}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${SERIES_CHART_HEIGHT}`}
      >
        <title id={titleId}>{title}</title>
        <desc id={descriptionId}>{chartDescription(description, title)}</desc>

        <g aria-hidden="true" className={styles.grid}>
          {scale.ticks.map((tick) => {
            const y = scaleLinear(
              tick,
              scale.min,
              scale.max,
              plotBottom,
              plotTop,
            );
            return (
              <g key={tick}>
                <line
                  className={styles.gridLine}
                  x1={plotLeft}
                  x2={plotRight}
                  y1={y}
                  y2={y}
                />
                <text
                  className={cx(styles.axisLabel, styles.yAxisLabel)}
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={plotLeft - 14}
                  y={y}
                >
                  {formatNumber(tick, formatValue)}
                </text>
              </g>
            );
          })}
          {labels.map((label, index) =>
            visibleLabels.has(index) ? (
              <text
                className={cx(styles.axisLabel, styles.xAxisLabel)}
                key={label}
                textAnchor="middle"
                x={
                  labels.length === 1
                    ? (plotLeft + plotRight) / 2
                    : scaleLinear(index, 0, labels.length - 1, plotLeft, plotRight)
                }
                y={plotBottom + 32}
              >
                {formatLabel(label)}
              </text>
            ) : null,
          )}
          <line
            className={styles.zeroLine}
            x1={plotLeft}
            x2={plotRight}
            y1={zeroY}
            y2={zeroY}
          />
        </g>

        {plottedSeries.map(({ coordinates, series: item }, seriesIndex) => {
          const { areaPath, linePath } = getSeriesPaths(coordinates, zeroY);

          return (
            <g
              aria-hidden="true"
              className={cx(
                styles.series,
                styles[`seriesVariant${seriesIndex % 4}`],
              )}
              key={item.id}
              style={chartColorStyle(
                "--chart-series-color",
                seriesColor(item.color, seriesIndex),
              )}
            >
              {variant === "area" && areaPath ? (
                <path
                  className={styles.area}
                  d={areaPath}
                  fill="var(--chart-series-color, currentColor)"
                />
              ) : null}
              {linePath ? (
                <path
                  className={styles.line}
                  d={linePath}
                  fill="none"
                  stroke="var(--chart-series-color, currentColor)"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {selectPointMarkers(coordinates).map(({ point, x, y }) => {
                const tooltip =
                  point.tooltip ??
                  tooltipFormatter?.(point, item) ??
                  `${item.label} · ${formatLabel(point.label)}: ${formatNumber(point.value, formatValue)}`;

                return (
                  <circle
                    className={styles.point}
                    cx={x}
                    cy={y}
                    fill="var(--chart-series-color, currentColor)"
                    key={point.id ?? point.label}
                    r="4"
                  >
                    <title>{tooltip}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
