export function compactSidebarDate(isoDate: string | null): string {
  if (isoDate === null) return "—"
  const [year, month, day] = isoDate.split("-")
  return year && month && day ? `${day}/${month}/${year}` : isoDate
}

export function formatBackupFilenameTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return "No disponible"
  return `${timestamp.slice(6, 8)}/${timestamp.slice(4, 6)}/${timestamp.slice(0, 4)} ${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)} · zona no indicada`
}

export function formatImportedAt(importedAt: string | undefined): string {
  if (!importedAt) return "No disponible"
  return `${importedAt.slice(8, 10)}/${importedAt.slice(5, 7)}/${importedAt.slice(0, 4)} ${importedAt.slice(11, 19)} UTC`
}

export function focusSidebarMainContent(): void {
  const focusMain = () => {
    const main = document.getElementById("main-content")
    main?.scrollIntoView?.({ behavior: "auto", block: "start" })
    main?.focus({ preventScroll: true })
  }

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focusMain)
  } else {
    window.setTimeout(focusMain, 0)
  }
}
