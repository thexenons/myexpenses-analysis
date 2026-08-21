import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import { countGlobalFilters, readGlobalFilterDate } from "../GlobalFilters.helpers"
import type {
  DateBoundary,
  GlobalFiltersViewProps,
} from "../GlobalFilters.types"

export function useGlobalFilters(): GlobalFiltersViewProps {
  const filters = useAppStore((state) => state.filters)
  const granularity = useAppStore((state) => state.granularity)
  const maxDate = useAppStore((state) => state.analytics?.maxDate ?? null)
  const minDate = useAppStore((state) => state.analytics?.minDate ?? null)
  const onOpenDrawer = useAppStore((state) => state.actions.openFilterDrawer)
  const patchFilters = useAppStore((state) => state.actions.patchFilters)
  const onGranularityChange = useAppStore((state) => state.actions.setGranularity)

  const onDateChange = (boundary: DateBoundary, value: string) => {
    patchFilters({
      dateRange: {
        ...filters.dateRange,
        [boundary]: readGlobalFilterDate(value),
      },
    })
  }

  return {
    activeFilterCount: countGlobalFilters(filters, granularity),
    filters,
    granularity,
    maxDate,
    minDate,
    onDateChange,
    onGranularityChange,
    onOpenDrawer,
    onScopeChange: (scope) => patchFilters({ scope }),
    onSearchChange: (search) => patchFilters({ search }),
  }
}
