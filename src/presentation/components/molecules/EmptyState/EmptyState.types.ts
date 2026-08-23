import type { HTMLAttributes, ReactNode, Ref } from "react"

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  actions?: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3
  icon?: ReactNode
  title: ReactNode
  ref?: Ref<HTMLDivElement>
}
