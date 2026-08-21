import type { HTMLAttributes, ReactNode, Ref } from "react"

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  actions?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  title: ReactNode
  ref?: Ref<HTMLDivElement>
}
