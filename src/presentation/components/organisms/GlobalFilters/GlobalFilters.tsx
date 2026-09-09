import { GlobalFiltersView } from "./GlobalFilters.view"
import { useGlobalFilters } from "./hooks/GlobalFilters.hooks"
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts"
import { PeriodComparison } from "../PeriodComparison/index.ts"

export function GlobalFilters() {
  const viewProps = useGlobalFilters()
  const { filtered } = useFilteredAnalytics()
  return <>
    <GlobalFiltersView {...viewProps} />
    {filtered !== null ? <PeriodComparison filtered={filtered} /> : null}
  </>
}
