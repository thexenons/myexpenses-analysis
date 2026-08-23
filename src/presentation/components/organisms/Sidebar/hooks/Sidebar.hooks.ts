import { useLocation } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"
import { focusSidebarMainContent } from "../Sidebar.helpers"
import type { SidebarViewProps } from "../Sidebar.types"

export function useSidebar(): SidebarViewProps {
  const accountCount = useAppStore((state) => state.analytics?.accounts.length ?? 0)
  const currentPath = useLocation({ select: (location) => location.pathname })
  const maxDate = useAppStore((state) => state.analytics?.maxDate ?? null)
  const minDate = useAppStore((state) => state.analytics?.minDate ?? null)
  const onLock = useAppStore((state) => state.actions.lock)
  const previousPath = useRef(currentPath)

  useEffect(() => {
    if (previousPath.current === currentPath) return

    previousPath.current = currentPath
    focusSidebarMainContent()
  }, [currentPath])

  return { accountCount, currentPath, maxDate, minDate, onLock }
}
