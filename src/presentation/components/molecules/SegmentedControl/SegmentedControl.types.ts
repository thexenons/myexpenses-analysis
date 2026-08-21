import type { ReactNode } from "react"

export interface SegmentedControlOption<Value extends string> {
  accessibleLabel?: string
  disabled?: boolean
  label: ReactNode
  shortLabel?: ReactNode
  value: Value
}

export interface SegmentedControlProps<Value extends string> {
  className?: string
  disabled?: boolean
  hideLabel?: boolean
  label: string
  name?: string
  onChange(value: Value): void
  options: readonly SegmentedControlOption<Value>[]
  value: Value
}
