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
          <div className={styles.canvas}>{children}</div>
          {dataTable}
        </>
      )}
    </figure>
  );
}
