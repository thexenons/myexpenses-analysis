import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import {
  chartColorStyle,
  seriesColor,
} from "../chart/chart.helpers.ts";
import styles from "../chart/chart.module.css";
import type { ChartLegendProps } from "./ChartLegend.types.ts";

export function ChartLegend({
  className,
  items,
  ref,
  valueFormatter,
  ...props
}: ChartLegendProps) {
  return (
    <ul {...props} className={cx(styles.legend, className)} ref={ref}>
      {items.map((item, index) => (
        <li
          className={cx(
            styles.legendItem,
            styles[`legendVariant${index % 4}`],
          )}
          key={item.id}
          style={chartColorStyle(
            "--chart-series-color",
            seriesColor(item.color, index),
          )}
        >
          <span aria-hidden="true" className={styles.legendSwatch} />
          <span className={styles.legendLabel}>{item.label}</span>
          {item.value === undefined ? null : (
            <data className={styles.legendValue} value={item.value}>
              {formatNumber(item.value, valueFormatter)}
            </data>
          )}
        </li>
      ))}
    </ul>
  );
}
