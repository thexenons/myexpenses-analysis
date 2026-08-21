import type { HTMLAttributes, ReactNode, Ref } from "react"

import type { Tone } from "../../atoms/Badge/Badge.types"
import type { ValueFormatter } from "../../../utils/component.helpers.ts"

export interface KpiTrend {
  direction: "up" | "down" | "flat"
  label: string
  value: number
  formatter?: Intl.NumberFormat | ValueFormatter
}

export interface KpiCardProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  detail?: ReactNode
  formatValue?: Intl.NumberFormat | ValueFormatter
  icon?: ReactNode
  label: ReactNode
  tone?: Tone
  trend?: KpiTrend
  value: number
  ref?: Ref<HTMLElement>
}
