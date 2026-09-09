import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
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
  for (const [field, prefix] of [["accountIds", "Cuenta"], ["originAccountIds", "Origen"], ["destinationAccountIds", "Destino"]] as const) {
    for (const id of filters[field] ?? []) {
      activeSelections.push({ id: `${field}:${id}`, label: `${prefix}: ${accountName(id)}`, onRemove: () => patchFilters({ [field]: (filters[field] ?? []).filter((candidate) => candidate !== id) }) })
    }
  }
  for (const path of filters.categoryPrefixes) {
    activeSelections.push({ id: `category:${JSON.stringify(path)}`, label: path.join(" › "), onRemove: () => patchFilters({ categoryPrefixes: filters.categoryPrefixes.filter((candidate) => candidate !== path) }) })
  }
  if (filters.scope !== "all") activeSelections.push({ id: "scope", label: filters.scope === "realCashFlow" ? "Flujo real" : "Solo deudas", onRemove: () => patchFilters({ scope: "all" }) })
  if (filters.dateRange.from !== null || filters.dateRange.to !== null) activeSelections.push({ id: "dates", label: `${filters.dateRange.from ?? "Inicio"} → ${filters.dateRange.to ?? "Fin"}`, onRemove: () => patchFilters({ dateRange: { from: null, to: null }, periodMode: "all" }) })
  if (filters.dateBasis === "value") activeSelections.push({ id: "dateBasis", label: "Fecha valor", onRemove: () => patchFilters({ dateBasis: "operation" }) })
  if (filters.categoryMatch === "either") activeSelections.push({ id: "categoryMatch", label: "Categoría de ambas partes", onRemove: () => patchFilters({ categoryMatch: "posting" }) })
  if (filters.categoryDepth === "exact") activeSelections.push({ id: "categoryDepth", label: "Categoría exacta", onRemove: () => patchFilters({ categoryDepth: "subtree" }) })
  if (filters.statuses.length > 0) activeSelections.push({ id: "statuses", label: `Estados: ${filters.statuses.length}`, onRemove: () => patchFilters({ statuses: [] }) })
  if (filters.linked !== "all") activeSelections.push({ id: "linked", label: filters.linked === "linked" ? "Vinculados" : "Sin vínculo", onRemove: () => patchFilters({ linked: "all" }) })
  for (const tag of filters.tags) activeSelections.push({ id: `tag:${tag}`, label: `Etiqueta: ${tag}`, onRemove: () => patchFilters({ tags: filters.tags.filter((candidate) => candidate !== tag) }) })
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
