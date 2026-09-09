/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The generated SVG itself is the image and supplies title, description and an exact-data table. */
import { useCallback, useImperativeHandle, useRef } from "react";

import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import { ChartDataTable } from "../ChartDataTable/index.ts";
import { ChartFrame } from "../ChartFrame/index.ts";
import { ChartLegend } from "../ChartLegend/index.ts";
import { ChartInspector } from "../chart/components/ChartInspector/index.ts";
import type { ChartInspectorHandle } from "../chart/components/ChartInspector/index.ts";
import {
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
  useChartSeriesVisibility,
  useChartWidth,
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
  onSelectPeriod,
  ref,
  series,
  title,
  tooltipFormatter,
  variant,
}: SeriesChartProps) {
  const { descriptionId, titleId } = useChartIds("series-chart");
  const { element: chartElement, setElement: setChartElement, width: chartWidth } = useChartWidth();
  useImperativeHandle(ref, () => chartElement!, [chartElement]);
  const inspectorRef = useRef<ChartInspectorHandle>(null);
  const { coloredSeries, hiddenSeriesIds, onToggleSeries, visibleSeries } = useChartSeriesVisibility(series);
  const {
    empty,
    labels,
    plotBottom,
    plotLeft,
    plotRight,
    plotTop,
    plottedSeries,
    scale,
    visibleLabels,
    zeroY,
  } = useSeriesChartModel(visibleSeries, chartWidth);
  const createDataTableRows = useCallback(() => {
    const valuesBySeriesAndLabel = visibleSeries.map((item) => {
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
  }, [labels, visibleSeries]);
  const getInspectorValues = useCallback((label: string) => visibleSeries.map((item) => {
    const point = item.data.find((candidate) => candidate.label === label);
    return {
      id: item.id, label: item.label, color: item.color,
      value: point !== undefined && Number.isFinite(point.value) ? point.value : null,
      detail: point?.tooltip ?? (point === undefined ? undefined : tooltipFormatter?.(point, item)),
    };
  }), [visibleSeries, tooltipFormatter]);

  return (
    <ChartFrame
      className={cx(
        variant === "line" ? styles.lineChart : styles.areaChart,
        className,
      )}
      dataTable={
        <>
        <ChartInspector
          formatLabel={formatLabel}
          formatValue={formatValue}
          getValues={getInspectorValues}
          items={labels.map((label) => ({ id: label, label }))}
          ref={inspectorRef}
          title={title}
        />
        <ChartDataTable
          caption={`Datos exactos de ${title}`}
          columns={visibleSeries.map((item) => ({ id: item.id, label: item.label }))}
          formatLabel={formatLabel}
          formatValue={formatValue}
          labelHeader="Periodo"
          onSelectRow={onSelectPeriod}
          rows={createDataTableRows}
        />
        </>
      }
      description={description}
      empty={empty}
      emptyMessage={visibleSeries.length === 0 && series.length > 0 ? "Todas las series están ocultas. Activa una en la leyenda." : emptyMessage}
      legend={<ChartLegend hiddenItemIds={hiddenSeriesIds} items={coloredSeries} onToggleItem={onToggleSeries} />}
      ref={setChartElement}
      title={title}
    >
      <svg
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={styles.svg}
        preserveAspectRatio="xMidYMid meet"
        onPointerLeave={() => inspectorRef.current?.dismiss()}
        role="img"
        viewBox={`0 0 ${chartWidth} ${SERIES_CHART_HEIGHT}`}
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
                textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
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

        {plottedSeries.map(({ coordinates, series: item }) => {
          const seriesIndex = coloredSeries.findIndex((candidate) => candidate.id === item.id);
          const { areaPath, linePath } = getSeriesPaths(coordinates, zeroY);

          return (
            <g
              aria-hidden="true"
              className={cx(
                styles.series,
                styles[`seriesVariant${seriesIndex % 8}`],
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
                    onPointerEnter={(event) => inspectorRef.current?.inspect(point.label, event.clientX, event.clientY)}
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
