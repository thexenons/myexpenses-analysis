import styles from "./EmptyState.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import type { EmptyStateProps } from "./EmptyState.types"

export function EmptyState({
  actions,
  className,
  description,
  icon,
  ref,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      {...props}
      className={cx(styles.root, className)}
      ref={ref}
    >
      {icon ? (
        <div aria-hidden="true" className={styles.icon}>
          {icon}
        </div>
      ) : null}
      <h3 className={styles.title}>{title}</h3>
      {description ? (
        <p className={styles.description}>{description}</p>
      ) : null}
      {actions ? (
        <div className={styles.actions}>{actions}</div>
      ) : null}
    </div>
  )
}
