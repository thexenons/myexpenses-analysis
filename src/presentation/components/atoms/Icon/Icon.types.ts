import type { SVGProps } from "react"

export type IconName =
  | "arrow-down"
  | "arrow-down-right"
  | "arrow-up"
  | "arrow-up-right"
  | "bank"
  | "calendar"
  | "category"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "debt"
  | "download"
  | "filter"
  | "receipt"
  | "search"
  | "transfer"
  | "trend"
  | "wallet"

export interface IconProps
  extends Omit<SVGProps<SVGSVGElement>, "children"> {
  label?: string
  name: IconName
  size?: number | string
}
