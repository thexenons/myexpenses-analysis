import type {
  FilterState,
  IsoDate,
  TimeGranularity,
} from "../../../../domain/analytics/types"

export function readGlobalFilterDate(value: string): IsoDate | null {
  return value === "" ? null : (value as IsoDate)
}

export function countGlobalFilters(
  filters: FilterState,
  granularity: TimeGranularity,
): number {
  let count = 0
  if (filters.scope !== "all") count += 1
  if (filters.dateRange.from !== null || filters.dateRange.to !== null) count += 1
  if (filters.accountIds.length > 0) count += 1
  if (filters.categoryPrefix.length > 0) count += 1
  if (filters.statuses.length > 0) count += 1
  if (filters.tags.length > 0) count += 1
  if (filters.search.trim().length > 0) count += 1
  if (filters.linked !== "all") count += 1
  if (granularity !== "month") count += 1
  return count
}
