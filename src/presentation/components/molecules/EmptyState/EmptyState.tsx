import styles from "./EmptyState.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import type { EmptyStateProps } from "./EmptyState.types"

export function EmptyState({
  actions,
  className,
  description,
  headingLevel = 3,
  icon,
  ref,
  title,
  ...props
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3"

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
      <Heading className={styles.title}>{title}</Heading>
      {description ? (
        <p className={styles.description}>{description}</p>
      ) : null}
      {actions ? (
        <div className={styles.actions}>{actions}</div>
      ) : null}
    </div>
  )
}
