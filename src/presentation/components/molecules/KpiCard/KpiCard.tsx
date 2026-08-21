import { FormattedNumber } from "../../atoms/FormattedNumber"
import styles from "./KpiCard.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import type { KpiCardProps } from "./KpiCard.types"

export function KpiCard({
  className,
  detail,
  formatValue,
  icon,
  label,
  ref,
  tone = "neutral",
  trend,
  value,
  ...props
}: KpiCardProps) {
  return (
    <article
      {...props}
      className={cx(styles.root, styles[tone], className)}
      ref={ref}
    >
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon ? (
          <span aria-hidden="true" className={styles.icon}>
            {icon}
          </span>
        ) : null}
      </div>

      <FormattedNumber
        className={styles.value}
        formatter={formatValue}
        value={value}
      />

      {detail || trend ? (
        <div className={styles.footer}>
          {trend ? (
            <span className={cx(styles.trend, styles[trend.direction])}>
              <span aria-hidden="true" className={styles.trendMark}>
                {trend.direction === "up"
                  ? "↑"
                  : trend.direction === "down"
                    ? "↓"
                    : "→"}
              </span>
              <span className={styles.visuallyHidden}>
                {trend.direction === "up"
                  ? "Sube"
                  : trend.direction === "down"
                    ? "Baja"
                    : "Sin cambio"}
              </span>
              <FormattedNumber
                className={styles.trendValue}
                formatter={trend.formatter}
                value={trend.value}
              />
              <span className={styles.trendLabel}>{trend.label}</span>
            </span>
          ) : null}
          {detail ? <span className={styles.detail}>{detail}</span> : null}
        </div>
      ) : null}
    </article>
  )
}
