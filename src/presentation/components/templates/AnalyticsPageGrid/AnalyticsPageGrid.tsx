import { cx } from "../../../utils/component.helpers.ts";
import styles from "./AnalyticsPageGrid.module.css";
import type { AnalyticsPageGridProps } from "./AnalyticsPageGrid.types.ts";

export function AnalyticsPageGrid({
  className,
  variant,
  ...props
}: AnalyticsPageGridProps) {
  return (
    <div
      {...props}
      className={cx(styles.grid, styles[variant], className)}
    />
  );
}
