import type {
  AnalyticsScope,
  FilterState,
  IsoDate,
  TimeGranularity,
} from "../../../../domain/analytics/types"

export type DateBoundary = "from" | "to"

export interface GlobalFiltersViewProps {
  activeFilterCount: number
  filters: FilterState
  granularity: TimeGranularity
  maxDate: IsoDate | null
  minDate: IsoDate | null
  onDateChange(boundary: DateBoundary, value: string): void
  onGranularityChange(granularity: TimeGranularity): void
  onOpenDrawer(): void
  onScopeChange(scope: AnalyticsScope): void
  onSearchChange(search: string): void
}
