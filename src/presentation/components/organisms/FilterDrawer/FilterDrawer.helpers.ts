import { accountMatchesScope } from "../../../../domain/analytics/filters.ts"
import type {
  AnalyticsScope,
  AnalyticsDataset,
  FilterState,
  IsoDate,
  TimeGranularity,
} from "../../../../domain/analytics/types"

const SPANISH_COLLATOR = new Intl.Collator("es", { sensitivity: "base" })

export function readFilterDrawerDate(value: string): IsoDate | null {
  return value === "" ? null : (value as IsoDate)
}

export function sortFilterDrawerAccounts(
  dataset: AnalyticsDataset | null,
  scope: AnalyticsScope,
) {
  return dataset === null
    ? []
    : dataset.accounts
        .filter((account) => accountMatchesScope(account, scope))
        .toSorted((left, right) =>
          SPANISH_COLLATOR.compare(left.label, right.label),
        )
}

export function collectFilterDrawerRootCategories(
  dataset: AnalyticsDataset | null,
): readonly string[] {
  return dataset === null
    ? []
    : Object.keys(dataset.source.categories).toSorted((left, right) =>
        SPANISH_COLLATOR.compare(left, right),
      )
}

export function collectFilterDrawerTags(
  dataset: AnalyticsDataset | null,
): readonly string[] {
  if (dataset === null) return []
  const tags = new Set<string>()
  for (const posting of dataset.postings) {
    for (const tag of posting.tags) tags.add(tag)
  }
  return [...tags].toSorted((left, right) => SPANISH_COLLATOR.compare(left, right))
}

export function toggleFilterDrawerUniversalValue<Value extends string>(
  selectedValues: readonly Value[],
  value: Value,
  allValues: readonly Value[],
): readonly Value[] {
  const selected = new Set(selectedValues.length === 0 ? allValues : selectedValues)
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  return selected.size === allValues.length
    ? []
    : allValues.filter((candidate) => selected.has(candidate))
}

export function toggleFilterDrawerOptionalValue(
  selectedValues: readonly string[],
  value: string,
): readonly string[] {
  const selected = new Set(selectedValues)
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  return [...selected]
}

export function hasActiveDrawerFilters(
  filters: FilterState,
  granularity: TimeGranularity,
): boolean {
  return (
    filters.scope !== "all" ||
    filters.dateRange.from !== null ||
    filters.dateRange.to !== null ||
    filters.accountIds.length > 0 ||
    filters.categoryPrefixes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.tags.length > 0 ||
    filters.search.trim().length > 0 ||
    filters.linked !== "all" ||
    granularity !== "month"
  )
}
