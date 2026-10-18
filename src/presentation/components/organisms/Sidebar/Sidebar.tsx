import { useSidebar } from "./hooks/Sidebar.hooks"
import { SidebarView } from "./Sidebar.view"
import { FinancialContextExport } from "../FinancialContextExport/index.ts"

export function Sidebar() {
  const viewProps = useSidebar()
  return <SidebarView {...viewProps} exportAction={<FinancialContextExport />} />
}
