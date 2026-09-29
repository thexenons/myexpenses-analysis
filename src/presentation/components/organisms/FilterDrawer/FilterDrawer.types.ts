import type { RefObject } from "react"

import type {
  AnalyticsScope,
  CategoryType,
  CurrencyCode,
  FilterState,
  LinkedFilter,
  NormalizedAccount,
} from "../../../../domain/analytics/types"
import type { IdentityOption } from "./FilterDrawer.helpers"

export interface FilterDrawerViewProps {
  accounts: readonly NormalizedAccount[]
  endpointAccounts: readonly NormalizedAccount[]
  categoryPaths: readonly (readonly string[])[]
  allAccountsSelected: boolean
  availableTags: readonly string[]
  payeeOptions: readonly IdentityOption[]
  methodOptions: readonly IdentityOption[]
  availableCurrencies: readonly CurrencyCode[]
  amountMinInput: string
  amountMaxInput: string
  amountError: string | null
  closeButtonRef: RefObject<HTMLButtonElement | null>
  dialogRef: RefObject<HTMLDialogElement | null>
  filters: FilterState
  hasActiveFilters: boolean
  onAccountToggle(accountId: string): void
  onOriginToggle(accountId: string): void
  onDestinationToggle(accountId: string): void
  onDateBasisChange(dateBasis: "operation" | "value"): void
  onCategoryMatchChange(categoryMatch: "posting" | "either"): void
  onCategoryDepthChange(categoryDepth: "subtree" | "exact"): void
  onCategoryToggle(path: readonly string[]): void
  onClose(): void
  onLinkedChange(linked: LinkedFilter): void
  onReset(): void
  onScopeChange(scope: AnalyticsScope): void
  onSearchChange(search: string): void
  onTagToggle(tag: string): void
  onPayeeToggle(key: string): void
  onMethodToggle(key: string): void
  onCategoryTypeToggle(value: CategoryType): void
  onCurrencyToggle(value: CurrencyCode): void
  onAmountInput(bound: "min" | "max", value: string): void
  onCommentSearchChange(value: string): void
  onReferenceSearchChange(value: string): void
  rootCategories: readonly string[]
}
