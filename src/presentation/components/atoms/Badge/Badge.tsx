import styles from "./Badge.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import type { BadgeProps } from "./Badge.types"

export function Badge({
  className,
  ref,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(styles.root, styles[tone], className)}
      ref={ref}
    />
  )
}
