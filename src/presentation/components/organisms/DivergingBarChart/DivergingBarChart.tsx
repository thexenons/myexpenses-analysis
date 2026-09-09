/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The generated SVG itself is the image and supplies title, description and an exact-data table. */
import { useCallback, useImperativeHandle, useRef } from "react";
import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import { ChartDataTable } from "../ChartDataTable/index.ts";
import { ChartFrame } from "../ChartFrame/index.ts";
import { ChartLegend } from "../ChartLegend/index.ts";
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
} from "../chart/chart.helpers.ts";
import styles from "../chart/chart.module.css";
import {
  useChartIds,
  useChartSeriesVisibility,
  useChartWidth,
  useDivergingBarChartModel,
} from "../chart/hooks/chart.hooks.ts";
import type { DivergingBarChartProps } from "./DivergingBarChart.types.ts";

export function DivergingBarChart({
  className,
  data,
  description,
  emptyMessage = "No hay datos para representar.",
  formatLabel = identityLabel,
  formatValue,
  leftColor,
  leftLabel,
  ref,
  rightColor,
  rightLabel,
  title,
}: DivergingBarChartProps) {
  const { descriptionId, titleId } = useChartIds("diverging-chart");
  const { element: chartElement, setElement: setChartElement, width: chartWidth, compact: compactChart } = useChartWidth();
  useImperativeHandle(ref, () => chartElement!, [chartElement]);
  const inspectorRef = useRef<ChartInspectorHandle>(null);
  const { hiddenSeriesIds, onToggleSeries } = useChartSeriesVisibility([
    { id: "left", label: leftLabel, data: [] },
    { id: "right", label: rightLabel, data: [] },
  ]);
  const leftVisible = !hiddenSeriesIds.has("left");
  const rightVisible = !hiddenSeriesIds.has("right");
  const {
    bars,
    centerX,
    chartHeight,
    legendItems,
    plotBottom,
    plotLeft,
    plotRight,
    resolvedLeftColor,
    resolvedRightColor,
    tickScale,
  } = useDivergingBarChartModel(
    data.map((datum) => ({ ...datum, leftValue: leftVisible ? datum.leftValue : 0, rightValue: rightVisible ? datum.rightValue : 0 })),
    leftColor,
    leftLabel,
    rightColor,
    rightLabel,
    chartWidth,
  );
  const getInspectorValues = useCallback((id: string) => {
    const datum = data.find((item) => item.id === id);
    return datum === undefined ? [] : [
      ...(leftVisible ? [{ id: "left", label: leftLabel, value: datum.leftValue, color: resolvedLeftColor, detail: datum.leftTooltip }] : []),
      ...(rightVisible ? [{ id: "right", label: rightLabel, value: datum.rightValue, color: resolvedRightColor, detail: datum.rightTooltip }] : []),
    ];
  }, [data, leftVisible, rightVisible, leftLabel, rightLabel, resolvedLeftColor, resolvedRightColor]);

  return (
    <ChartFrame
      className={cx(styles.divergingBars, className)}
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
          columns={[
            ...(leftVisible ? [{ id: "left", label: leftLabel }] : []),
            ...(rightVisible ? [{ id: "right", label: rightLabel }] : []),
          ]}
          formatLabel={formatLabel}
          formatValue={formatValue}
          labelHeader="Periodo"
          rows={bars.map(({ datum }) => ({
            id: datum.id,
            label: datum.label,
            values: [...(leftVisible ? [datum.leftValue] : []), ...(rightVisible ? [datum.rightValue] : [])],
          }))}
        />
        </>
      }
      description={description}
      empty={bars.length === 0 || (!leftVisible && !rightVisible)}
      emptyMessage={!leftVisible && !rightVisible ? "Todas las series están ocultas. Activa una en la leyenda." : emptyMessage}
      legend={<ChartLegend hiddenItemIds={hiddenSeriesIds} items={legendItems} onToggleItem={onToggleSeries} />}
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
          {tickScale.ticks.filter((tick, index) => !compactChart || tick === 0 || index === 0 || index === tickScale.ticks.length - 1).map((tick) => {
            const x = scaleLinear(
              tick,
              tickScale.min,
              tickScale.max,
              plotLeft,
              plotRight,
            );
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
                  textAnchor={tick === tickScale.min ? "start" : tick === tickScale.max ? "end" : "middle"}
                  x={x}
                  y={plotBottom + 30}
                >
                  {formatNumber(Math.abs(tick), formatValue)}
                </text>
              </g>
            );
          })}
          <line
            className={styles.zeroLine}
            x1={centerX}
            x2={centerX}
            y1={BAR_MARGIN.top}
            y2={plotBottom}
          />
        </g>

        {bars.map(({ centerY, datum, leftWidth, rightWidth }) => {
          const leftTooltip =
            datum.leftTooltip ??
            `${leftLabel} · ${formatLabel(datum.label)}: ${formatNumber(datum.leftValue, formatValue)}`;
          const rightTooltip =
            datum.rightTooltip ??
            `${rightLabel} · ${formatLabel(datum.label)}: ${formatNumber(datum.rightValue, formatValue)}`;

          return (
            <g aria-hidden="true" className={styles.barGroup} key={datum.id} onPointerEnter={(event) => inspectorRef.current?.inspect(datum.id, event.clientX, event.clientY)}>
              <text
                className={styles.barLabel}
                dominantBaseline="middle"
                textAnchor={compactChart ? "start" : "end"}
                x={compactChart ? plotLeft : plotLeft - 16}
                y={compactChart ? centerY - 12 : centerY}
              >
                {compactChartLabel(formatLabel(datum.label))}
              </text>
              {leftVisible ? <rect
                className={cx(styles.bar, styles.leftBar)}
                fill="var(--chart-left-color, currentColor)"
                height={compactChart ? 12 : BAR_ROW_HEIGHT * 0.52}
                rx="4"
                style={chartColorStyle("--chart-left-color", resolvedLeftColor)}
                width={leftWidth}
                x={centerX - leftWidth}
                y={compactChart ? centerY + 3 : centerY - BAR_ROW_HEIGHT * 0.26}
              >
                <title>{leftTooltip}</title>
              </rect> : null}
              {rightVisible ? <rect
                className={cx(styles.bar, styles.rightBar)}
                fill="var(--chart-right-color, currentColor)"
                height={compactChart ? 12 : BAR_ROW_HEIGHT * 0.52}
                rx="4"
                style={chartColorStyle("--chart-right-color", resolvedRightColor)}
                width={rightWidth}
                x={centerX}
                y={compactChart ? centerY + 3 : centerY - BAR_ROW_HEIGHT * 0.26}
              >
                <title>{rightTooltip}</title>
              </rect> : null}
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
