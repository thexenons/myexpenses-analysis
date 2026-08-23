import { FilterDrawer } from "../../organisms/FilterDrawer"
import { GlobalFilters } from "../../organisms/GlobalFilters"
import { Sidebar } from "../../organisms/Sidebar"
import { useAppShell } from "./hooks/AppShell.hooks.ts"
import styles from "./AppShell.module.css"
import type { AppShellProps } from "./AppShell.types"

export function AppShell({ children }: AppShellProps) {
  const { mainRef } = useAppShell()

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Ir al contenido principal
      </a>
      <Sidebar />
      <div className={styles.workspace}>
        <GlobalFilters />
        <main
          className={styles.main}
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <FilterDrawer />
    </div>
  )
}
