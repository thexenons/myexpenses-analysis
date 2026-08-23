import { useEffect, useRef } from "react"

import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts"

const AUTOMATIC_LOCK_DELAY_MS = 15 * 60 * 1_000

function useAutomaticLock(onLock: () => void): void {
  useEffect(() => {
    let lastActivity = Date.now()
    let lastTimerRefresh = lastActivity
    let lockTimer: ReturnType<typeof setTimeout> | undefined
    let locked = false

    const lock = () => {
      if (locked) return
      const remaining = AUTOMATIC_LOCK_DELAY_MS - (Date.now() - lastActivity)
      if (remaining > 0) {
        lockTimer = setTimeout(lock, remaining)
        return
      }
      locked = true
      onLock()
    }
    const scheduleLock = () => {
      if (lockTimer !== undefined) clearTimeout(lockTimer)
      const remaining = AUTOMATIC_LOCK_DELAY_MS - (Date.now() - lastActivity)
      if (remaining <= 0) {
        lock()
        return
      }
      lockTimer = setTimeout(lock, remaining)
    }
    const recordActivity = () => {
      if (document.visibilityState === "hidden" || locked) return
      const now = Date.now()
      lastActivity = now
      // Scroll and repeated keys can fire dozens of times per frame. The lock
      // callback rechecks the exact deadline, so refreshing once a second is exact.
      if (now - lastTimerRefresh < 1_000) return
      lastTimerRefresh = now
      scheduleLock()
    }
    const checkVisibility = () => {
      if (document.visibilityState === "visible") scheduleLock()
    }

    const passiveOptions = { passive: true } as const
    const passiveCaptureOptions = { capture: true, passive: true } as const
    scheduleLock()
    window.addEventListener("keydown", recordActivity, passiveOptions)
    window.addEventListener("pointerdown", recordActivity, passiveOptions)
    window.addEventListener("scroll", recordActivity, passiveCaptureOptions)
    document.addEventListener("visibilitychange", checkVisibility)

    return () => {
      if (lockTimer !== undefined) clearTimeout(lockTimer)
      window.removeEventListener("keydown", recordActivity)
      window.removeEventListener("pointerdown", recordActivity)
      window.removeEventListener("scroll", recordActivity, true)
      document.removeEventListener("visibilitychange", checkVisibility)
    }
  }, [onLock])
}

export function useAppShell() {
  const mainRef = useRef<HTMLElement>(null)
  const onLock = useAppStore((state) => state.actions.lock)
  useAutomaticLock(onLock)

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
  }, [])

  return { mainRef }
}
