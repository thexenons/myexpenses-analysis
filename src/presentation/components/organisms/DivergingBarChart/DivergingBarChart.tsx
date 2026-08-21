import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import { ChartDataTable } from "../ChartDataTable/index.ts";
import { ChartFrame } from "../ChartFrame/index.ts";
import { ChartLegend } from "../ChartLegend/index.ts";
import {
  BAR_MARGIN,
  BAR_ROW_HEIGHT,
  CHART_WIDTH,
  chartColorStyle,
  chartDescription,
  identityLabel,
  scaleLinear,
} from "../chart/chart.helpers.ts";
import styles from "../chart/chart.module.css";
import {
  useChartIds,
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
  const {
    bars,
    centerX,
    chartHeight,
    legendItems,
    plotBottom,
    resolvedLeftColor,
    resolvedRightColor,
    tickScale,
  } = useDivergingBarChartModel(
    data,
    leftColor,
    leftLabel,
    rightColor,
    rightLabel,
  );

  return (
    <ChartFrame
      className={cx(styles.divergingBars, className)}
      dataTable={
        <ChartDataTable
          caption={`Datos exactos de ${title}`}
          columns={[
            { id: "left", label: leftLabel },
            { id: "right", label: rightLabel },
          ]}
          formatLabel={formatLabel}
          formatValue={formatValue}
          labelHeader="Periodo"
          rows={bars.map(({ datum }) => ({
            id: datum.id,
            label: datum.label,
            values: [datum.leftValue, datum.rightValue],
          }))}
        />
      }
      description={description}
      empty={bars.length === 0}
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
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
      >
        <title id={titleId}>{title}</title>
        <desc id={descriptionId}>{chartDescription(description, title)}</desc>

        <g aria-hidden="true" className={styles.grid}>
          {tickScale.ticks.map((tick) => {
            const x = scaleLinear(
              tick,
              tickScale.min,
              tickScale.max,
              BAR_MARGIN.left,
              CHART_WIDTH - BAR_MARGIN.right,
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
                  textAnchor="middle"
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
            <g aria-hidden="true" className={styles.barGroup} key={datum.id}>
              <text
                className={styles.barLabel}
                dominantBaseline="middle"
                textAnchor="end"
                x={BAR_MARGIN.left - 16}
                y={centerY}
              >
                {formatLabel(datum.label)}
              </text>
              <rect
                className={cx(styles.bar, styles.leftBar)}
                fill="var(--chart-left-color, currentColor)"
                height={BAR_ROW_HEIGHT * 0.52}
                rx="4"
                style={chartColorStyle("--chart-left-color", resolvedLeftColor)}
                width={leftWidth}
                x={centerX - leftWidth}
                y={centerY - BAR_ROW_HEIGHT * 0.26}
              >
                <title>{leftTooltip}</title>
              </rect>
              <rect
                className={cx(styles.bar, styles.rightBar)}
                fill="var(--chart-right-color, currentColor)"
                height={BAR_ROW_HEIGHT * 0.52}
                rx="4"
                style={chartColorStyle("--chart-right-color", resolvedRightColor)}
                width={rightWidth}
                x={centerX}
                y={centerY - BAR_ROW_HEIGHT * 0.26}
              >
                <title>{rightTooltip}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
