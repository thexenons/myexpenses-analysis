import { FilterDrawerView } from "./FilterDrawer.view"
import { useFilterDrawer } from "./hooks/FilterDrawer.hooks"

export function FilterDrawer() {
  const viewProps = useFilterDrawer()
  return <FilterDrawerView {...viewProps} />
}
