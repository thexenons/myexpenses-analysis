import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import { countGlobalFilters } from "../GlobalFilters.helpers"
import type { GlobalFiltersViewProps } from "../GlobalFilters.types"

export function useGlobalFilters(): GlobalFiltersViewProps {
  const filters = useAppStore((state) => state.filters)
  const granularity = useAppStore((state) => state.granularity)
  const onOpenDrawer = useAppStore((state) => state.actions.openFilterDrawer)
  const patchFilters = useAppStore((state) => state.actions.patchFilters)

  return {
    activeFilterCount: countGlobalFilters(filters, granularity),
    filters,
    onOpenDrawer,
    onScopeChange: (scope) => patchFilters({ scope }),
    onSearchChange: (search) => patchFilters({ search }),
  }
}
