import styles from "./IconButton.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import type { IconButtonProps } from "./IconButton.types"

export function IconButton({
  className,
  icon,
  label,
  ref,
  title,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={cx(styles.root, className)}
      ref={ref}
      title={title ?? label}
      type={type}
    >
      <span aria-hidden="true" className={styles.icon}>
        {icon}
      </span>
    </button>
  )
}
