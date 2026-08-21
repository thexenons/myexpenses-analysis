import type { HTMLAttributes, Ref } from "react"

import type { ValueFormatter } from "../../../utils/component.helpers.ts"

export interface FormattedNumberProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  formatter?: Intl.NumberFormat | ValueFormatter
  value: number
  ref?: Ref<HTMLDataElement>
}
