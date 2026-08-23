import type {
  AnalyticsScope,
  FilterState,
} from "../../../../domain/analytics/types"

export interface GlobalFiltersViewProps {
  activeFilterCount: number
  filters: FilterState
  onOpenDrawer(): void
  onScopeChange(scope: AnalyticsScope): void
  onSearchChange(search: string): void
}
