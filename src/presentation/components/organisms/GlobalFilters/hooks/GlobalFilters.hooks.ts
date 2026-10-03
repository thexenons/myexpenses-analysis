import { useMemo } from "react"
import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import { DEFAULT_APP_SCOPE } from "../../../../../application/store/app-store/app-store.helpers.ts"
import { formatCategoryPath } from "../../../../utils/format.ts"
import { categoryPathsEqual } from "../../../../../domain/analytics/filters.ts"
import { collectIdentityOptions, formatAbsoluteEurMinor, identityOptionLabel } from "../../FilterDrawer/FilterDrawer.helpers.ts"
import { countGlobalFilters } from "../GlobalFilters.helpers"
import type { GlobalFiltersViewProps } from "../GlobalFilters.types"

export function useGlobalFilters(): GlobalFiltersViewProps {
  const filters = useAppStore((state) => state.filters)
  const granularity = useAppStore((state) => state.granularity)
  const onOpenDrawer = useAppStore((state) => state.actions.openFilterDrawer)
  const patchFilters = useAppStore((state) => state.actions.patchFilters)
  const analytics = useAppStore((state) => state.analytics)
  const setGranularity = useAppStore((state) => state.actions.setGranularity)
  const activeSelections: GlobalFiltersViewProps["activeSelections"][number][] = []
  const accountName = (id: string) => analytics?.accounts.find((account) => account.id === id)?.label ?? "Cuenta no disponible"
  const payeeOptions = useMemo(() => collectIdentityOptions(analytics, "payee"), [analytics])
  const methodOptions = useMemo(() => collectIdentityOptions(analytics, "method"), [analytics])
  const identityLabel = (key: string, kind: "payee" | "method") => (kind === "payee" ? payeeOptions : methodOptions).find((option) => option.key === key)?.label ?? identityOptionLabel(key, undefined, kind)
  for (const [field, prefix] of [["accountIds", "Cuenta"], ["originAccountIds", "Origen"], ["destinationAccountIds", "Destino"]] as const) {
    for (const id of filters[field] ?? []) {
      activeSelections.push({ id: `${field}:${id}`, label: `${field === "accountIds" && filters.accountMode === "exclude" ? "Excluir cuenta" : prefix}: ${accountName(id)}`, onRemove: () => patchFilters({ [field]: (filters[field] ?? []).filter((candidate) => candidate !== id) }) })
    }
  }
  for (const path of filters.categoryPrefixes) {
    activeSelections.push({ id: `category:${JSON.stringify(path)}`, label: `${filters.categoryMode === "exclude" ? "Excluir: " : ""}${formatCategoryPath(path)}`, onRemove: () => patchFilters({ categoryPrefixes: filters.categoryPrefixes.filter((candidate) => !categoryPathsEqual(candidate, path)) }) })
  }
  if (filters.scope !== DEFAULT_APP_SCOPE) activeSelections.push({ id: "scope", label: filters.scope === "all" ? "Yo" : "Solo deudas", onRemove: () => patchFilters({ scope: DEFAULT_APP_SCOPE }) })
  if (filters.dateRange.from !== null || filters.dateRange.to !== null) activeSelections.push({ id: "dates", label: `${filters.dateRange.from ?? "Inicio"} → ${filters.dateRange.to ?? "Fin"}`, onRemove: () => patchFilters({ dateRange: { from: null, to: null }, periodMode: "all" }) })
  if (filters.dateBasis === "value") activeSelections.push({ id: "dateBasis", label: "Fecha valor", onRemove: () => patchFilters({ dateBasis: "operation" }) })
  if (filters.categoryMatch === "either") activeSelections.push({ id: "categoryMatch", label: "Categoría de ambas partes", onRemove: () => patchFilters({ categoryMatch: "posting" }) })
  if (filters.categoryDepth === "exact") activeSelections.push({ id: "categoryDepth", label: "Categoría exacta", onRemove: () => patchFilters({ categoryDepth: "subtree" }) })
  if (filters.linked !== "all") activeSelections.push({ id: "linked", label: filters.linked === "linked" ? "Vinculados" : "Sin vínculo", onRemove: () => patchFilters({ linked: "all" }) })
  for (const tag of filters.tags) activeSelections.push({ id: `tag:${tag}`, label: `${filters.tagMode === "exclude" ? "Excluir etiqueta" : "Etiqueta"}: ${tag}`, onRemove: () => patchFilters({ tags: filters.tags.filter((candidate) => candidate !== tag) }) })
  if (filters.search.trim()) activeSelections.push({ id: "search", label: `Texto: ${filters.search.trim()}`, onRemove: () => patchFilters({ search: "" }) })
  for (const key of filters.payeeKeys ?? []) activeSelections.push({ id: `payee:${key}`, label: `Beneficiario: ${identityLabel(key, "payee")}`, onRemove: () => patchFilters({ payeeKeys: (filters.payeeKeys ?? []).filter((candidate) => candidate !== key) }) })
  for (const key of filters.paymentMethodKeys ?? []) activeSelections.push({ id: `method:${key}`, label: `Método: ${identityLabel(key, "method")}`, onRemove: () => patchFilters({ paymentMethodKeys: (filters.paymentMethodKeys ?? []).filter((candidate) => candidate !== key) }) })
  for (const value of filters.categoryTypes ?? []) activeSelections.push({ id: `type:${value}`, label: `Tipo: ${{ EXPENSE: "gasto", INCOME: "ingreso", TRANSFER: "transferencia", NEUTRAL: "neutral" }[value]}`, onRemove: () => patchFilters({ categoryTypes: (filters.categoryTypes ?? []).filter((candidate) => candidate !== value) }) })
  for (const value of filters.currencies ?? []) activeSelections.push({ id: `currency:${value}`, label: `Moneda: ${value}`, onRemove: () => patchFilters({ currencies: (filters.currencies ?? []).filter((candidate) => candidate !== value) }) })
  if (filters.minAmountEurMinor != null) activeSelections.push({ id: "minAmount", label: `Importe absoluto ≥ ${formatAbsoluteEurMinor(filters.minAmountEurMinor)} EUR`, onRemove: () => patchFilters({ minAmountEurMinor: null }) })
  if (filters.maxAmountEurMinor != null) activeSelections.push({ id: "maxAmount", label: `Importe absoluto ≤ ${formatAbsoluteEurMinor(filters.maxAmountEurMinor)} EUR`, onRemove: () => patchFilters({ maxAmountEurMinor: null }) })
  if (filters.commentSearch?.trim()) activeSelections.push({ id: "comment", label: `Comentario: ${filters.commentSearch.trim()}`, onRemove: () => patchFilters({ commentSearch: "" }) })
  if (filters.referenceSearch?.trim()) activeSelections.push({ id: "reference", label: `Referencia: ${filters.referenceSearch.trim()}`, onRemove: () => patchFilters({ referenceSearch: "" }) })
  if (granularity !== "auto") activeSelections.push({ id: "granularity", label: `Agrupación: ${{ day: "día", week: "semana", month: "mes", year: "año" }[granularity]}`, onRemove: () => setGranularity("auto") })

  return {
    activeFilterCount: countGlobalFilters(filters, granularity),
    activeSelections,
    filters,
    onOpenDrawer,
    onScopeChange: (scope) => patchFilters({ scope }),
    onSearchChange: (search) => patchFilters({ search }),
  }
}
