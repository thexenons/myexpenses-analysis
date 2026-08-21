import styles from "./FormattedNumber.module.css"
import { cx, formatNumber } from "../../../utils/component.helpers.ts"
import type { FormattedNumberProps } from "./FormattedNumber.types"

export function FormattedNumber({
  className,
  formatter,
  ref,
  value,
  ...props
}: FormattedNumberProps) {
  return (
    <data
      {...props}
      className={cx(styles.root, className)}
      ref={ref}
      value={value}
    >
      {formatNumber(value, formatter)}
    </data>
  )
}
