import { cx } from "../../../utils/component.helpers.ts"
import { getIconGeometry } from "./Icon.helpers"
import styles from "./Icon.module.css"
import type { IconProps } from "./Icon.types"

export function Icon({
  className,
  label,
  name,
  size = 20,
  ...props
}: IconProps) {
  const accessibleLabel = label ?? props["aria-label"]
  const labelled = Boolean(accessibleLabel ?? props["aria-labelledby"])

  return (
    <svg
      {...props}
      aria-hidden={labelled ? undefined : true}
      aria-label={accessibleLabel}
      className={cx(styles.icon, className)}
      fill="none"
      focusable="false"
      height={size}
      role={labelled ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {accessibleLabel ? <title>{accessibleLabel}</title> : null}
      {getIconGeometry(name)}
    </svg>
  )
}
