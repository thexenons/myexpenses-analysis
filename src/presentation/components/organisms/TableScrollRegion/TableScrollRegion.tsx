/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Named overflow regions must receive focus for keyboard panning. */
import type { ReactNode } from "react"

import { cx } from "../../../utils/component.helpers.ts"
import styles from "./TableScrollRegion.module.css"

/** Shared scroll semantics; each table retains its own structure and controls. */
export function TableScrollRegion({
  children,
  className,
  label,
  labelledBy,
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly label?: string
  readonly labelledBy?: string
}) {
  return (
    <section aria-label={label} aria-labelledby={labelledBy} className={cx(styles.scroller, className)} tabIndex={0}>
      {children}
    </section>
  )
}
