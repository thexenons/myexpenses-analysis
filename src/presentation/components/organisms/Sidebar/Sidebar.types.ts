import type { IsoDate } from "../../../../domain/analytics/types"
import type { BackupDatasetSourceV1 } from "../../../../domain/analytics/backup-dataset.types"

export interface SidebarViewProps {
  accountCount: number
  currentPath: string
  maxDate: IsoDate | null
  minDate: IsoDate | null
  onLock: () => void
  source: BackupDatasetSourceV1 | null
  appRevision: string | null
}
