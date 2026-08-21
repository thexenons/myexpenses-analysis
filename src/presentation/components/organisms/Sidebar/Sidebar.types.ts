import type { IsoDate } from "../../../../domain/analytics/types"

export interface SidebarViewProps {
  accountCount: number
  currentPath: string
  maxDate: IsoDate | null
  minDate: IsoDate | null
}
