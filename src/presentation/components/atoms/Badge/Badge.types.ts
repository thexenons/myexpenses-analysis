import type { HTMLAttributes, Ref } from "react"

export type Tone =
  | "neutral"
  | "positive"
  | "negative"
  | "warning"
  | "info"
  | "accent"
  | "debt"
  | "cash"

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  ref?: Ref<HTMLSpanElement>
}
