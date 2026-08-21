import { cx } from "../../../utils/component.helpers.ts"
import styles from "./Button.module.css"
import type { ButtonProps } from "./Button.types"

export function Button({
  children,
  className,
  endIcon,
  fullWidth = false,
  icon,
  ref,
  size = "regular",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        styles.root,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      ref={ref}
      type={type}
    >
      {icon ? (
        <span aria-hidden="true" className={styles.icon}>
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {endIcon ? (
        <span aria-hidden="true" className={styles.icon}>
          {endIcon}
        </span>
      ) : null}
    </button>
  )
}
