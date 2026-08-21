import { useId } from "react"

import { Icon } from "../../atoms/Icon"
import { IconButton } from "../../atoms/IconButton"
import { cx } from "../../../utils/component.helpers.ts"
import styles from "./SearchField.module.css"
import type { SearchFieldProps } from "./SearchField.types"

export function SearchField({
  className,
  disabled,
  hideLabel = false,
  id,
  label,
  onValueChange,
  placeholder = "Buscar movimientos, cuentas o notas…",
  ref,
  value,
  ...props
}: SearchFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={cx(styles.field, className)}>
      <label
        className={cx(styles.label, hideLabel && styles.visuallyHidden)}
        htmlFor={inputId}
      >
        {label}
      </label>
      <div className={styles.control}>
        <Icon className={styles.searchIcon} name="search" size={18} />
        <input
          {...props}
          className={styles.input}
          disabled={disabled}
          id={inputId}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          placeholder={placeholder}
          ref={ref}
          type="search"
          value={value}
        />
        {value.length > 0 ? (
          <IconButton
            className={styles.clearButton}
            disabled={disabled}
            icon={<Icon name="close" size={16} />}
            label="Limpiar búsqueda"
            onClick={() => onValueChange("")}
          />
        ) : null}
      </div>
    </div>
  )
}
