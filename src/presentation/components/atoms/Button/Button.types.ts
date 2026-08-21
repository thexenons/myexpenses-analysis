import type {
  ButtonHTMLAttributes,
  ReactNode,
  Ref,
} from "react"

export type ButtonSize = "compact" | "regular"
export type ButtonVariant = "primary" | "secondary" | "ghost"

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  endIcon?: ReactNode
  fullWidth?: boolean
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
  size?: ButtonSize
  variant?: ButtonVariant
}
