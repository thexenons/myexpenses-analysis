import {
  useEffect,
  useMemo,
  useRef,
} from "react"

import type { TransactionStatus } from "../../../../../domain/analytics/types"
import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import {
  collectFilterDrawerRootCategories,
  collectFilterDrawerTags,
  hasActiveDrawerFilters,
  readFilterDrawerDate,
  sortFilterDrawerAccounts,
  toggleFilterDrawerOptionalValue,
  toggleFilterDrawerUniversalValue,
} from "../FilterDrawer.helpers"
import type {
  FilterDrawerDateBoundary,
  FilterDrawerViewProps,
} from "../FilterDrawer.types"

const STATUS_VALUES: readonly TransactionStatus[] = [
  "UNRECONCILED",
  "CLEARED",
  "RECONCILED",
  "VOID",
]

export function useFilterDrawer(): FilterDrawerViewProps {
  const analytics = useAppStore((state) => state.analytics)
  const clearFilters = useAppStore((state) => state.actions.clearFilters)
  const onClose = useAppStore((state) => state.actions.closeFilterDrawer)
  const filters = useAppStore((state) => state.filters)
  const granularity = useAppStore((state) => state.granularity)
  const open = useAppStore((state) => state.filterDrawerOpen)
  const patchFilters = useAppStore((state) => state.actions.patchFilters)
  const setAccountIds = useAppStore((state) => state.actions.setAccountIds)
  const setCategoryPrefix = useAppStore((state) => state.actions.setCategoryPrefix)
  const onGranularityChange = useAppStore((state) => state.actions.setGranularity)
  const setStatuses = useAppStore((state) => state.actions.setStatuses)
  const setTags = useAppStore((state) => state.actions.setTags)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const accounts = useMemo(
    () => sortFilterDrawerAccounts(analytics, filters.scope),
    [analytics, filters.scope],
  )
  const accountIds = useMemo(
    () => accounts.map((account) => account.id),
    [accounts],
  )
  const rootCategories = useMemo(
    () => collectFilterDrawerRootCategories(analytics),
    [analytics],
  )
  const availableTags = useMemo(
    () => collectFilterDrawerTags(analytics),
    [analytics],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      closeButtonRef.current?.focus()
      return
    }

    if (!open && dialog.open) {
      dialog.close()
      const previousFocus = previousFocusRef.current
      previousFocusRef.current = null
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])

  const onDateChange = (boundary: FilterDrawerDateBoundary, value: string) => {
    patchFilters({
      dateRange: {
        ...filters.dateRange,
        [boundary]: readFilterDrawerDate(value),
      },
    })
  }

  return {
    accounts,
    allAccountsSelected: filters.accountIds.length === 0,
    allStatusesSelected: filters.statuses.length === 0,
    availableTags,
    closeButtonRef,
    dialogRef,
    filters,
    granularity,
    hasActiveFilters: hasActiveDrawerFilters(filters, granularity),
    maxDate: analytics?.maxDate ?? null,
    minDate: analytics?.minDate ?? null,
    onAccountToggle: (accountId) =>
      setAccountIds(
        toggleFilterDrawerUniversalValue(filters.accountIds, accountId, accountIds),
      ),
    onCategoryChange: (category) =>
      setCategoryPrefix(category === "" ? [] : [category]),
    onClose,
    onDateChange,
    onGranularityChange,
    onLinkedChange: (linked) => patchFilters({ linked }),
    onReset: () => {
      clearFilters()
      onGranularityChange("month")
    },
    onScopeChange: (scope) => patchFilters({ scope }),
    onSearchChange: (search) => patchFilters({ search }),
    onStatusToggle: (status) =>
      setStatuses(
        toggleFilterDrawerUniversalValue(filters.statuses, status, STATUS_VALUES),
      ),
    onTagToggle: (tag) =>
      setTags(toggleFilterDrawerOptionalValue(filters.tags, tag)),
    rootCategories,
  }
}
