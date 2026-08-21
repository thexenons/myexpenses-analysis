import { GlobalFiltersView } from "./GlobalFilters.view"
import { useGlobalFilters } from "./hooks/GlobalFilters.hooks"

export function GlobalFilters() {
  const viewProps = useGlobalFilters()
  return <GlobalFiltersView {...viewProps} />
}
