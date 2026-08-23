import type { RefObject } from "react"

import type {
  AnalyticsScope,
  FilterState,
  LinkedFilter,
  NormalizedAccount,
  TransactionStatus,
} from "../../../../domain/analytics/types"

export interface FilterDrawerViewProps {
  accounts: readonly NormalizedAccount[]
  allAccountsSelected: boolean
  allStatusesSelected: boolean
  availableTags: readonly string[]
  closeButtonRef: RefObject<HTMLButtonElement | null>
  dialogRef: RefObject<HTMLDialogElement | null>
  filters: FilterState
  hasActiveFilters: boolean
  onAccountToggle(accountId: string): void
  onCategoryToggle(path: readonly string[]): void
  onClose(): void
  onLinkedChange(linked: LinkedFilter): void
  onReset(): void
  onScopeChange(scope: AnalyticsScope): void
  onSearchChange(search: string): void
  onStatusToggle(status: TransactionStatus): void
  onTagToggle(tag: string): void
  rootCategories: readonly string[]
}
