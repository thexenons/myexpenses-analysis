import { useLocation } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import { focusSidebarMainContent } from "../Sidebar.helpers"
import type { SidebarViewProps } from "../Sidebar.types"

declare const MYEXPENSES_PUBLIC_REVISION: string | null

export function useSidebar(): SidebarViewProps {
  const accountCount = useAppStore((state) => state.analytics?.accounts.length ?? 0)
  const currentPath = useLocation({ select: (location) => location.pathname })
  const maxDate = useAppStore((state) => state.analytics?.maxDate ?? null)
  const minDate = useAppStore((state) => state.analytics?.minDate ?? null)
  const onLock = useAppStore((state) => state.actions.lock)
  const source = useAppStore((state) => state.analytics?.backup?.source ?? null)
  const appRevision =
    typeof MYEXPENSES_PUBLIC_REVISION === "undefined"
      ? null
      : MYEXPENSES_PUBLIC_REVISION
  const previousPath = useRef(currentPath)

  useEffect(() => {
    if (previousPath.current === currentPath) return

    previousPath.current = currentPath
    focusSidebarMainContent()
  }, [currentPath])

  return { accountCount, currentPath, maxDate, minDate, onLock, source, appRevision }
}
