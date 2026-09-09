import { cx, formatNumber } from "../../../utils/component.helpers.ts";
import {
  chartColorStyle,
  seriesColor,
} from "../chart/chart.helpers.ts";
import styles from "../chart/chart.module.css";
import type { ChartLegendProps } from "./ChartLegend.types.ts";

export function ChartLegend({
  className,
  hiddenItemIds,
  items,
  onToggleItem,
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
            styles[`legendVariant${index % 8}`],
          )}
          key={item.id}
          style={chartColorStyle(
            "--chart-series-color",
            seriesColor(item.color, index),
          )}
        >
          {onToggleItem ? (
            <button
              aria-label={`${hiddenItemIds?.has(item.id) ? "Mostrar" : "Ocultar"} serie: ${item.label}`}
              aria-pressed={!hiddenItemIds?.has(item.id)}
              className={styles.legendButton}
              onClick={() => onToggleItem(item.id)}
              type="button"
            >
              <span aria-hidden="true" className={styles.legendSwatch} />
              <span className={styles.legendLabel}>{item.label}</span>
            </button>
          ) : (
            <>
              <span aria-hidden="true" className={styles.legendSwatch} />
              <span className={styles.legendLabel}>{item.label}</span>
            </>
          )}
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
