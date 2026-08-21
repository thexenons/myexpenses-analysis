import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import { ChartDataTable } from "../ChartDataTable/index.ts";
import { ChartFrame } from "../ChartFrame/index.ts";
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
  labelHeader = "Elemento",
  ref,
  title,
  tooltipFormatter,
}: HorizontalBarChartProps) {
  const { descriptionId, titleId } = useChartIds("bar-chart");
  const {
    bars,
    chartHeight,
    plotBottom,
    plotLeft,
    plotRight,
    scale,
    zeroX,
  } = useHorizontalBarChartModel(data);

  return (
    <ChartFrame
      className={cx(styles.horizontalBars, className)}
      dataTable={
        <ChartDataTable
          caption={`Datos exactos de ${title}`}
          columns={[{ id: "value", label: "Importe" }]}
          formatLabel={formatLabel}
          formatValue={formatValue}
          labelHeader={labelHeader}
          rows={bars.map(({ datum }) => ({
            id: datum.id,
            label: datum.label,
            values: [datum.value],
          }))}
        />
      }
      description={description}
      empty={bars.length === 0}
      emptyMessage={emptyMessage}
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
          {scale.ticks.map((tick) => {
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
                  textAnchor="middle"
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
              style={chartColorStyle("--chart-series-color", color)}
            >
              <title>{tooltip}</title>
              <text
                className={styles.barLabel}
                dominantBaseline="middle"
                textAnchor="end"
                x={plotLeft - 16}
                y={centerY}
              >
                {formatLabel(datum.label)}
              </text>
              <rect
                className={styles.bar}
                fill="var(--chart-series-color, currentColor)"
                height={BAR_ROW_HEIGHT * 0.52}
                rx="4"
                width={barWidth}
                x={barX}
                y={centerY - BAR_ROW_HEIGHT * 0.26}
              />
              <text
                className={styles.barValue}
                dominantBaseline="middle"
                textAnchor="start"
                x={plotRight + 10}
                y={centerY}
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
