/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Only overflowing chart regions receive a keyboard entry for panning. */
import { cx } from "../../../utils/component.helpers.ts";
import styles from "../chart/chart.module.css";
import type { ChartFrameProps } from "./ChartFrame.types.ts";

export function ChartFrame({
  children,
  className,
  dataTable,
  description,
  empty,
  emptyMessage,
  legend,
  ref,
  scrollable = false,
  title,
}: ChartFrameProps) {
  return (
    <figure className={cx(styles.root, className)} ref={ref}>
      <figcaption className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </figcaption>
      {legend}
      {empty ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        <>
          <section
            aria-label={scrollable ? `Gráfico desplazable: ${title}` : undefined}
            className={styles.canvas}
            tabIndex={scrollable ? 0 : undefined}
          >{children}</section>
          {dataTable}
        </>
      )}
    </figure>
  );
}
