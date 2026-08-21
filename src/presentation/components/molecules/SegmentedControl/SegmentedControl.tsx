import { useId } from "react"

import { cx } from "../../../utils/component.helpers.ts"
import styles from "./SegmentedControl.module.css"
import type { SegmentedControlProps } from "./SegmentedControl.types"

export function SegmentedControl<Value extends string>({
  className,
  disabled = false,
  hideLabel = false,
  label,
  name,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  const generatedName = useId()
  const controlName = name ?? generatedName

  return (
    <fieldset
      className={cx(styles.fieldset, className)}
      disabled={disabled}
    >
      <legend
        className={cx(styles.legend, hideLabel && styles.visuallyHidden)}
      >
        {label}
      </legend>
      <div className={styles.options}>
        {options.map((option, index) => {
          const optionId = `${controlName}-${index}`
          return (
            <label className={styles.option} htmlFor={optionId} key={option.value}>
              <input
                aria-label={
                  option.accessibleLabel ??
                  (typeof option.label === "string" ? option.label : undefined)
                }
                checked={value === option.value}
                className={styles.input}
                disabled={option.disabled}
                id={optionId}
                name={controlName}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span className={styles.label}>
                <span className={styles.longLabel}>{option.label}</span>
                {option.shortLabel ? (
                  <span aria-hidden="true" className={styles.shortLabel}>
                    {option.shortLabel}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
