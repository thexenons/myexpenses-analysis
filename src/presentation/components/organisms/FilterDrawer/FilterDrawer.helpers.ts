import { accountMatchesScope } from "../../../../domain/analytics/filters.ts"
import { DEFAULT_APP_SCOPE } from "../../../../application/store/app-store/app-store.helpers.ts"
import { formatCategoryPath } from "../../../utils/format.ts"
import type {
  AnalyticsScope,
  AnalyticsDataset,
  CategoriesRegistry,
  FilterState,
  TimeGranularitySetting,
} from "../../../../domain/analytics/types"
import { payeeIdentityKey, paymentMethodIdentityKey } from "../../../../domain/analytics/identity-keys.ts"

const SPANISH_COLLATOR = new Intl.Collator("es", { sensitivity: "base" })

export interface IdentityOption { key: string; label: string }

export function identityOptionLabel(key: string, label: string | undefined, kind: "payee" | "method", disambiguate = false): string {
  const parsed: unknown = JSON.parse(key)
  if (!Array.isArray(parsed)) return label ?? "No disponible"
  if (parsed[0] === "missing") return kind === "payee" ? "Sin beneficiario" : "Sin método de pago"
  if (parsed[0] === "source") {
    const name = label?.trim()
    return name ? (disambiguate ? `${name} (ID ${parsed[1]})` : name) : `Sin nombre (ID ${parsed[1]})`
  }
  const name = (label || String(parsed[1])).trim() || "Sin nombre"
  return disambiguate ? `${name} (sin ID)` : name
}

export function collectIdentityOptions(dataset: AnalyticsDataset | null, kind: "payee" | "method"): readonly IdentityOption[] {
  if (dataset === null) return []
  const options = new Map<string, string | undefined>()
  for (const posting of dataset.postings) {
    if (posting.isVoid) continue;
    const key = kind === "payee" ? payeeIdentityKey(posting) : paymentMethodIdentityKey(posting)
    const label = kind === "payee" ? posting.payee : posting.paymentMethod
    options.set(key, label)
  }
  const frequencies = new Map<string, number>()
  for (const label of options.values()) {
    const name = label?.trim().toLocaleLowerCase("es")
    if (name) frequencies.set(name, (frequencies.get(name) ?? 0) + 1)
  }
  return [...options].map(([key, label]) => ({
    key,
    label: identityOptionLabel(key, label, kind, (frequencies.get(label?.trim().toLocaleLowerCase("es") ?? "") ?? 0) > 1),
  })).toSorted((a, b) => SPANISH_COLLATOR.compare(a.label, b.label))
}

export function includeSelectedIdentityOptions(options: readonly IdentityOption[], selected: readonly string[], kind: "payee" | "method"): readonly IdentityOption[] {
  const known = new Set(options.map((option) => option.key))
  return [...options, ...selected.filter((key) => !known.has(key)).map((key) => ({ key, label: `${identityOptionLabel(key, undefined, kind)} · no disponible entre movimientos activos` }))]
}

/** Parse an absolute EUR amount without floating-point cent rounding. */
export function parseAbsoluteEurMinor(value: string): number | null | undefined {
  const input = value.trim()
  if (input === "") return null
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(input)) return undefined
  const [euros, fractional = ""] = input.replace(",", ".").split(".")
  const cents = Number(euros) * 100 + Number(fractional.padEnd(2, "0"))
  return Number.isSafeInteger(cents) ? cents : undefined
}

export function formatAbsoluteEurMinor(value: number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const cents = BigInt(value)
  return `${cents / 100n},${String(cents % 100n).padStart(2, "0")}`
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
    if (posting.isVoid) continue;
    for (const tag of posting.tags) tags.add(tag)
  }
  return [...tags].toSorted((left, right) => SPANISH_COLLATOR.compare(left, right))
}

export function collectFilterDrawerCategoryPaths(dataset: AnalyticsDataset | null): readonly (readonly string[])[] {
  if (dataset === null) return []
  const paths = new Map<string, readonly string[]>()
  const collectRegistryPaths = (registry: CategoriesRegistry, parent: readonly string[]) => {
    for (const [label, entry] of Object.entries(registry)) {
      const path = [...parent, label]
      paths.set(JSON.stringify(path), path)
      if (entry.children) collectRegistryPaths(entry.children, path)
    }
  }
  collectRegistryPaths(dataset.source.categories, [])
  for (const posting of dataset.postings) {
    if (posting.isVoid) continue;
    if (posting.categoryPath.length === 0) paths.set("[]", [])
    for (let length = 1; length <= posting.categoryPath.length; length += 1) {
      const path = posting.categoryPath.slice(0, length)
      paths.set(JSON.stringify(path), path)
    }
  }
  return [...paths.values()].toSorted((left, right) => SPANISH_COLLATOR.compare(formatCategoryPath(left), formatCategoryPath(right)))
}

export function toggleFilterDrawerUniversalValue<Value extends string>(
  selectedValues: readonly Value[],
  value: Value,
  allValues: readonly Value[],
): readonly Value[] {
  const selected = new Set(selectedValues.length === 0 ? allValues : selectedValues)
  if (selected.size === 1 && selected.has(value)) return selectedValues
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
  granularity: TimeGranularitySetting,
): boolean {
  return (
    filters.scope !== DEFAULT_APP_SCOPE ||
    filters.dateRange.from !== null ||
    filters.dateRange.to !== null ||
    filters.accountIds.length > 0 ||
    (filters.originAccountIds?.length ?? 0) > 0 ||
    (filters.destinationAccountIds?.length ?? 0) > 0 ||
    filters.dateBasis === "value" ||
    filters.categoryMatch === "either" ||
    filters.categoryDepth === "exact" ||
    filters.categoryPrefixes.length > 0 ||
    filters.tags.length > 0 ||
    filters.search.trim().length > 0 ||
    filters.linked !== "all" ||
    (filters.payeeKeys?.length ?? 0) > 0 ||
    (filters.paymentMethodKeys?.length ?? 0) > 0 ||
    (filters.categoryTypes?.length ?? 0) > 0 ||
    (filters.currencies?.length ?? 0) > 0 ||
    filters.minAmountEurMinor != null ||
    filters.maxAmountEurMinor != null ||
    (filters.commentSearch?.trim().length ?? 0) > 0 ||
    (filters.referenceSearch?.trim().length ?? 0) > 0 ||
    granularity !== "auto"
  )
}
