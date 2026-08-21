import { useSidebar } from "./hooks/Sidebar.hooks"
import { SidebarView } from "./Sidebar.view"

export function Sidebar() {
  const viewProps = useSidebar()
  return <SidebarView {...viewProps} />
}
