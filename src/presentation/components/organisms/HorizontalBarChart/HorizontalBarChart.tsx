/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The generated SVG itself is the image and supplies title, description and an exact-data table. */
import { useCallback, useImperativeHandle, useRef } from "react";
import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import { ChartDataTable } from "../ChartDataTable/index.ts";
import { ChartFrame } from "../ChartFrame/index.ts";
import { ChartInspector } from "../chart/components/ChartInspector/index.ts";
import type { ChartInspectorHandle } from "../chart/components/ChartInspector/index.ts";
import {
  BAR_MARGIN,
  BAR_ROW_HEIGHT,
  chartColorStyle,
  chartDescription,
  compactChartLabel,
  identityLabel,
  scaleLinear,
  seriesColor,
} from "../chart/chart.helpers.ts";
import styles from "../chart/chart.module.css";
import {
  useChartIds,
  useChartRanking,
  useChartWidth,
  useHorizontalBarChartModel,
} from "../chart/hooks/chart.hooks.ts";
import type { HorizontalBarChartProps } from "./HorizontalBarChart.types.ts";

export function HorizontalBarChart({
  className,
  data,
  description,
  emptyMessage = "No hay datos para representar.",
  formatLabel = identityLabel,
  formatValue,
  initialLimit = 12,
  labelHeader = "Elemento",
  onSelectDatum,
  ref,
  title,
  tooltipFormatter,
  valueHeader = "Valor",
}: HorizontalBarChartProps) {
  const { descriptionId, titleId } = useChartIds("bar-chart");
  const { element: chartElement, setElement: setChartElement, width: chartWidth, compact: compactChart } = useChartWidth();
  useImperativeHandle(ref, () => chartElement!, [chartElement]);
  const inspectorRef = useRef<ChartInspectorHandle>(null);
  const { limit, setLimit, visibleData } = useChartRanking(data, initialLimit);
  const {
    bars,
    chartHeight,
    plotBottom,
    plotLeft,
    plotRight,
    scale,
    zeroX,
  } = useHorizontalBarChartModel(visibleData, chartWidth);
  const getInspectorValues = useCallback((id: string) => {
    const index = data.findIndex((item) => item.id === id);
    const datum = data[index];
    return datum === undefined ? [] : [{
      id: datum.id, label: valueHeader, value: datum.value, color: seriesColor(datum.color, index),
      detail: datum.tooltip ?? tooltipFormatter?.(datum),
    }];
  }, [data, tooltipFormatter, valueHeader]);

  return (
    <ChartFrame
      className={cx(styles.horizontalBars, className)}
      dataTable={
        <>
        <ChartInspector
          formatLabel={formatLabel}
          formatValue={formatValue}
          getValues={getInspectorValues}
          items={bars.map(({ datum }) => ({ id: datum.id, label: datum.label }))}
          ref={inspectorRef}
          title={title}
        />
        <ChartDataTable
          caption={`Datos exactos de ${title}`}
          columns={[{ id: "value", label: valueHeader }]}
          formatLabel={formatLabel}
          formatValue={formatValue}
          labelHeader={labelHeader}
          onSelectRow={onSelectDatum}
          rows={data.filter((datum) => Number.isFinite(datum.value)).map((datum) => ({
            id: datum.id,
            label: datum.label,
            values: [datum.value],
          }))}
        />
        </>
      }
      description={description}
      empty={bars.length === 0}
      emptyMessage={emptyMessage}
      legend={data.length > 5 ? (
        <div className={styles.controls}>
          <label className={styles.control}>
            Mostrar en {title}
            <select onChange={(event) => setLimit(Number(event.target.value))} value={limit}>
              <option value={5}>Primeros 5</option>
              <option value={12}>Primeros 12</option>
              <option value={25}>Primeros 25</option>
              {![0, 5, 12, 25].includes(initialLimit) ? <option value={initialLimit}>Primeros {initialLimit}</option> : null}
              <option value={0}>Todos ({data.length})</option>
            </select>
          </label>
          <span>Tabla y CSV: {data.length} elementos completos.</span>
        </div>
      ) : undefined}
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
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <title id={titleId}>{title}</title>
        <desc id={descriptionId}>{chartDescription(description, title)}</desc>

        <g aria-hidden="true" className={styles.grid}>
          {scale.ticks.filter((_tick, index) => !compactChart || index === 0 || index === scale.ticks.length - 1 || (chartWidth >= 320 && index === Math.floor((scale.ticks.length - 1) / 2))).map((tick) => {
            const x = scaleLinear(tick, scale.min, scale.max, plotLeft, plotRight);
            return (
              <g key={tick}>
                <line
                  className={styles.gridLine}
                  x1={x}
                  x2={x}
                  y1={BAR_MARGIN.top}
                  y2={plotBottom}
                />
                <text
                  className={cx(styles.axisLabel, styles.xAxisLabel)}
                  textAnchor={tick === scale.min ? "start" : tick === scale.max ? "end" : "middle"}
                  x={x}
                  y={plotBottom + 30}
                >
                  {formatNumber(tick, formatValue)}
                </text>
              </g>
            );
          })}
          <line
            className={styles.zeroLine}
            x1={zeroX}
            x2={zeroX}
            y1={BAR_MARGIN.top}
            y2={plotBottom}
          />
        </g>

        {bars.map(({ barWidth, barX, centerY, color, datum }) => {
          const tooltip =
            datum.tooltip ??
            tooltipFormatter?.(datum) ??
            `${formatLabel(datum.label)}: ${formatNumber(datum.value, formatValue)}`;

          return (
            <g
              aria-hidden="true"
              className={styles.barGroup}
              key={datum.id}
              onPointerEnter={(event) => inspectorRef.current?.inspect(datum.id, event.clientX, event.clientY)}
              style={chartColorStyle("--chart-series-color", color)}
            >
              <title>{tooltip}</title>
              <text
                className={styles.barLabel}
                dominantBaseline="middle"
                textAnchor={compactChart ? "start" : "end"}
                x={compactChart ? plotLeft : plotLeft - 16}
                y={compactChart ? centerY - 12 : centerY}
              >
                {compactChartLabel(formatLabel(datum.label), compactChart ? Math.max(10, Math.floor((plotRight - plotLeft - 95) / 6)) : 32)}
              </text>
              <rect
                className={styles.bar}
                fill="var(--chart-series-color, currentColor)"
                height={compactChart ? 12 : BAR_ROW_HEIGHT * 0.52}
                rx="4"
                width={barWidth}
                x={barX}
                y={compactChart ? centerY + 3 : centerY - BAR_ROW_HEIGHT * 0.26}
              />
              <text
                className={styles.barValue}
                dominantBaseline="middle"
                textAnchor={compactChart ? "end" : "start"}
                x={compactChart ? plotRight : plotRight + 10}
                y={compactChart ? centerY - 12 : centerY}
              >
                {formatNumber(datum.value, formatValue)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
