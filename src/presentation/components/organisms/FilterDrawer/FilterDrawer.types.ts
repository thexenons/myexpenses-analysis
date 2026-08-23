import type { RefObject } from "react"

import type {
  AnalyticsScope,
  FilterState,
  IsoDate,
  LinkedFilter,
  NormalizedAccount,
  TimeGranularity,
  TransactionStatus,
} from "../../../../domain/analytics/types"

export type FilterDrawerDateBoundary = "from" | "to"

export interface FilterDrawerViewProps {
  accounts: readonly NormalizedAccount[]
  allAccountsSelected: boolean
  allStatusesSelected: boolean
  availableTags: readonly string[]
  closeButtonRef: RefObject<HTMLButtonElement | null>
  dialogRef: RefObject<HTMLDialogElement | null>
  filters: FilterState
  granularity: TimeGranularity
  hasActiveFilters: boolean
  maxDate: IsoDate | null
  minDate: IsoDate | null
  onAccountToggle(accountId: string): void
  onCategoryToggle(path: readonly string[]): void
  onClose(): void
  onDateChange(boundary: FilterDrawerDateBoundary, value: string): void
  onGranularityChange(granularity: TimeGranularity): void
  onLinkedChange(linked: LinkedFilter): void
  onReset(): void
  onScopeChange(scope: AnalyticsScope): void
  onSearchChange(search: string): void
  onStatusToggle(status: TransactionStatus): void
  onTagToggle(tag: string): void
  rootCategories: readonly string[]
}
