import type {
  AnalyticsScope,
  FilterState,
} from "../../../../domain/analytics/types"

export interface GlobalFiltersViewProps {
  activeFilterCount: number
  activeSelections: readonly { id: string; label: string; onRemove(): void }[]
  filters: FilterState
  onOpenDrawer(): void
  onScopeChange(scope: AnalyticsScope): void
  onSearchChange(search: string): void
}
