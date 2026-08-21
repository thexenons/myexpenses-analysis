import type {
  InputHTMLAttributes,
  Ref,
} from "react"

export interface SearchFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "type" | "value"
  > {
  hideLabel?: boolean
  label: string
  onValueChange(value: string): void
  ref?: Ref<HTMLInputElement>
  value: string
}
