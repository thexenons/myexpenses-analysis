import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { CategoryType, CurrencyCode } from "../../../../../domain/analytics/types"
import { toggleCategoryPath } from "../../../../../domain/analytics/filters.ts"
import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import {
  collectFilterDrawerRootCategories,
  collectFilterDrawerCategoryPaths,
  collectFilterDrawerTags,
  collectIdentityOptions,
  formatAbsoluteEurMinor,
  includeSelectedIdentityOptions,
  hasActiveDrawerFilters,
  parseAbsoluteEurMinor,
  sortFilterDrawerAccounts,
  toggleFilterDrawerOptionalValue,
  toggleFilterDrawerUniversalValue,
} from "../FilterDrawer.helpers"
import type { FilterDrawerViewProps } from "../FilterDrawer.types"

export function useFilterDrawer(): FilterDrawerViewProps {
  const analytics = useAppStore((state) => state.analytics)
  const clearFilters = useAppStore((state) => state.actions.clearFilters)
  const onClose = useAppStore((state) => state.actions.closeFilterDrawer)
  const filters = useAppStore((state) => state.filters)
  const filterResetRevision = useAppStore((state) => state.filterResetRevision)
  const granularity = useAppStore((state) => state.granularity)
  const open = useAppStore((state) => state.filterDrawerOpen)
  const patchFilters = useAppStore((state) => state.actions.patchFilters)
  const setAccountIds = useAppStore((state) => state.actions.setAccountIds)
  const setCategoryPrefixes = useAppStore(
    (state) => state.actions.setCategoryPrefixes,
  )
  const onGranularityChange = useAppStore((state) => state.actions.setGranularity)
  const setTags = useAppStore((state) => state.actions.setTags)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [amountMinInput, setAmountMinInput] = useState(() => formatAbsoluteEurMinor(filters.minAmountEurMinor))
  const [amountMaxInput, setAmountMaxInput] = useState(() => formatAbsoluteEurMinor(filters.maxAmountEurMinor))
  const [amountError, setAmountError] = useState<string | null>(null)
  const appliedAmountRef = useRef([filters.minAmountEurMinor ?? null, filters.maxAmountEurMinor ?? null] as const)
  const lastResetRevisionRef = useRef(filterResetRevision)

  const accounts = useMemo(
    () => sortFilterDrawerAccounts(analytics, filters.scope),
    [analytics, filters.scope],
  )
  const accountIds = useMemo(
    () => accounts.map((account) => account.id),
    [accounts],
  )
  const endpointAccounts = useMemo(() => sortFilterDrawerAccounts(analytics, "all"), [analytics])
  const categoryPaths = useMemo(() => collectFilterDrawerCategoryPaths(analytics), [analytics])
  const rootCategories = useMemo(
    () => collectFilterDrawerRootCategories(analytics),
    [analytics],
  )
  const availableTags = useMemo(
    () => collectFilterDrawerTags(analytics),
    [analytics],
  )
  const payeeOptions = useMemo(() => includeSelectedIdentityOptions(collectIdentityOptions(analytics, "payee"), filters.payeeKeys ?? [], "payee"), [analytics, filters.payeeKeys])
  const methodOptions = useMemo(() => includeSelectedIdentityOptions(collectIdentityOptions(analytics, "method"), filters.paymentMethodKeys ?? [], "method"), [analytics, filters.paymentMethodKeys])
  const availableCurrencies = useMemo(() => [...new Set([...(analytics?.postings.filter((posting) => !posting.isVoid).map((posting) => posting.currency) ?? []), ...(filters.currencies ?? [])])].toSorted(), [analytics, filters.currencies])

  useEffect(() => {
    const min = filters.minAmountEurMinor ?? null
    const max = filters.maxAmountEurMinor ?? null
    const explicitlyReset = filterResetRevision !== lastResetRevisionRef.current
    lastResetRevisionRef.current = filterResetRevision
    if (min === appliedAmountRef.current[0] && max === appliedAmountRef.current[1] && !explicitlyReset) return
    appliedAmountRef.current = [min, max]
    setAmountMinInput(formatAbsoluteEurMinor(min))
    setAmountMaxInput(formatAbsoluteEurMinor(max))
    setAmountError(null)
  }, [filterResetRevision, filters.minAmountEurMinor, filters.maxAmountEurMinor])

  const onAmountInput = (bound: "min" | "max", value: string) => {
    if (bound === "min") setAmountMinInput(value)
    else setAmountMaxInput(value)
    const min = parseAbsoluteEurMinor(bound === "min" ? value : amountMinInput)
    const max = parseAbsoluteEurMinor(bound === "max" ? value : amountMaxInput)
    if (min === undefined || max === undefined) {
      setAmountError("Rango no aplicado: introduce importes positivos con hasta dos decimales.")
      return
    }
    if (min !== null && max !== null && min > max) {
      setAmountError("Rango no aplicado: el mínimo no puede superar el máximo.")
      return
    }
    setAmountError(null)
    appliedAmountRef.current = [min, max]
    patchFilters({ minAmountEurMinor: min, maxAmountEurMinor: max })
  }

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

  return {
    accounts,
    endpointAccounts,
    categoryPaths,
    allAccountsSelected: filters.accountIds.length === 0,
    availableTags,
    payeeOptions,
    methodOptions,
    availableCurrencies,
    amountMinInput,
    amountMaxInput,
    amountError,
    closeButtonRef,
    dialogRef,
    filters,
    hasActiveFilters: hasActiveDrawerFilters(filters, granularity) || amountError !== null,
    onAccountToggle: (accountId) =>
      setAccountIds(
        toggleFilterDrawerUniversalValue(filters.accountIds, accountId, accountIds),
      ),
    onCategoryToggle: (path) =>
      setCategoryPrefixes(toggleCategoryPath(filters.categoryPrefixes, path)),
    onOriginToggle: (accountId) => patchFilters({ originAccountIds: toggleFilterDrawerOptionalValue(filters.originAccountIds ?? [], accountId) }),
    onDestinationToggle: (accountId) => patchFilters({ destinationAccountIds: toggleFilterDrawerOptionalValue(filters.destinationAccountIds ?? [], accountId) }),
    onDateBasisChange: (dateBasis) => patchFilters({ dateBasis }),
    onCategoryMatchChange: (categoryMatch) => patchFilters({ categoryMatch }),
    onCategoryModeChange: (categoryMode) => patchFilters({ categoryMode }),
    onCategoryDepthChange: (categoryDepth) => patchFilters({ categoryDepth }),
    onClose,
    onLinkedChange: (linked) => patchFilters({ linked }),
    onReset: () => {
      clearFilters()
      onGranularityChange("auto")
    },
    onScopeChange: (scope) => patchFilters({ scope }),
    onSearchChange: (search) => patchFilters({ search }),
    onTagToggle: (tag) =>
      setTags(toggleFilterDrawerOptionalValue(filters.tags, tag)),
    onPayeeToggle: (key) => patchFilters({ payeeKeys: toggleFilterDrawerOptionalValue(filters.payeeKeys ?? [], key) }),
    onMethodToggle: (key) => patchFilters({ paymentMethodKeys: toggleFilterDrawerOptionalValue(filters.paymentMethodKeys ?? [], key) }),
    onCategoryTypeToggle: (value: CategoryType) => patchFilters({ categoryTypes: toggleFilterDrawerOptionalValue(filters.categoryTypes ?? [], value) as CategoryType[] }),
    onCurrencyToggle: (value: CurrencyCode) => patchFilters({ currencies: toggleFilterDrawerOptionalValue(filters.currencies ?? [], value) as CurrencyCode[] }),
    onAmountInput,
    onCommentSearchChange: (commentSearch) => patchFilters({ commentSearch }),
    onReferenceSearchChange: (referenceSearch) => patchFilters({ referenceSearch }),
    rootCategories,
  }
}
