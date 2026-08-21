import type {
  ButtonHTMLAttributes,
  ReactNode,
  Ref,
} from "react"

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: ReactNode
  label: string
  ref?: Ref<HTMLButtonElement>
}
