export function compactSidebarDate(isoDate: string | null): string {
  if (isoDate === null) return "—"
  const [year, month, day] = isoDate.split("-")
  return year && month && day ? `${day}/${month}/${year}` : isoDate
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
