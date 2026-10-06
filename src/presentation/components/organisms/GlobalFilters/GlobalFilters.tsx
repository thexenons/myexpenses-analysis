import { GlobalFiltersView } from "./GlobalFilters.view"
import { useGlobalFilters } from "./hooks/GlobalFilters.hooks"
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts"
import { PeriodComparison } from "../PeriodComparison/index.ts"

import type { PeriodComparisonProps } from "../PeriodComparison/PeriodComparison.types.ts"

export function GlobalFilters({ onViewCategory }: Pick<PeriodComparisonProps, "onViewCategory"> = {}) {
  const viewProps = useGlobalFilters()
  const { filtered, searchPending } = useFilteredAnalytics()
  return <>
    <GlobalFiltersView {...viewProps} />
    {filtered !== null ? <PeriodComparison filtered={filtered} searchPending={searchPending} onViewCategory={onViewCategory} /> : null}
  </>
}
