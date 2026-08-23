import type {
  FilterState,
  TimeGranularitySetting,
} from "../../../../domain/analytics/types"

export function countGlobalFilters(
  filters: FilterState,
  granularity: TimeGranularitySetting,
): number {
  let count = 0
  if (filters.scope !== "all") count += 1
  if (filters.dateRange.from !== null || filters.dateRange.to !== null) count += 1
  if (filters.accountIds.length > 0) count += 1
  if (filters.categoryPrefixes.length > 0) count += 1
  if (filters.statuses.length > 0) count += 1
  if (filters.tags.length > 0) count += 1
  if (filters.search.trim().length > 0) count += 1
  if (filters.linked !== "all") count += 1
  if (granularity !== "auto") count += 1
  return count
}
