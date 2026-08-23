import { cx } from "../../../../utils/component.helpers.ts";
import styles from "./BudgetUtilization.module.css";
import type { BudgetUtilizationProps } from "./BudgetUtilization.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function BudgetUtilization({
  health,
  label,
  utilization,
  variant = "compact",
}: BudgetUtilizationProps) {
  const progress = utilization === null ? 0 : Math.min(Math.max(utilization, 0), 1);
  const valueText =
    utilization === null ? "Sin asignación" : percentageFormatter.format(utilization);

  return (
    <div
      className={cx(
        styles.root,
        variant === "hero" && styles.hero,
        health === "watch" && styles.watch,
        health === "exceeded" && styles.exceeded,
        health === "unallocated" && styles.unallocated,
      )}
    >
      <div className={styles.heading}>
        <span className={styles.label}>{label}</span>
        <strong className={styles.value}>{valueText}</strong>
      </div>
      <meter
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={valueText}
        className={styles.track}
        max={100}
        min={0}
        value={progress * 100}
      >
        {valueText}
      </meter>
    </div>
  );
}
