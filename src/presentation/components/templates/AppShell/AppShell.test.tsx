import {
  createMemoryHistory,
  RouterContextProvider,
} from "@tanstack/react-router"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import userEvent from "@testing-library/user-event"
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts"
import { createDefaultFilterState } from "../../../../domain/analytics/filters.ts"
import { appStore } from "../../../../composition/app-store.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import { createAppRouter } from "../../../router/app-router.ts"
import { AppShell } from "./AppShell"

function resetAppStore() {
  window.localStorage.clear()
  appStore.setState(appStore.getInitialState(), true)
  appStore.setState({ loadPhase: "ready" })
}

describe("AppShell", () => {
  beforeEach(resetAppStore)
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("composes navigation, global filters, drawer and a skippable main region", () => {
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    render(
      <RouterContextProvider router={router}>
        <AppStoreProvider store={appStore}>
          <AppShell>
            <h1>Panel de prueba</h1>
          </AppShell>
        </AppStoreProvider>
      </RouterContextProvider>,
    )

    expect(screen.getByRole("link", { name: "Ir al contenido principal" })).toHaveAttribute(
      "href",
      "#main-content",
    )
    const main = screen.getByRole("main")
    expect(main).toHaveAttribute("id", "main-content")
    return waitFor(() => expect(main).toHaveFocus())
  })

  it("keeps the page heading and navigation inside distinct landmarks", () => {
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    render(
      <RouterContextProvider router={router}>
        <AppStoreProvider store={appStore}>
          <AppShell>
            <h1>Panel de prueba</h1>
          </AppShell>
        </AppStoreProvider>
      </RouterContextProvider>,
    )

    const main = screen.getByRole("main")
    expect(within(main).getByRole("heading", { name: "Panel de prueba" })).toBeVisible()
    expect(screen.getByRole("navigation", { name: "Secciones principales" })).toBeVisible()
    expect(screen.getByRole("region", { name: "Filtros globales" })).toBeVisible()
  })

  it("locks after 15 minutes without activity and resets the deadline on activity", () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, "error")
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    const { unmount } = render(
      <RouterContextProvider router={router}>
        <AppStoreProvider store={appStore}>
          <AppShell>
            <h1>Panel de prueba</h1>
          </AppShell>
        </AppStoreProvider>
      </RouterContextProvider>,
    )
    const persistedBeforeActivity = Array.from(
      { length: window.localStorage.length },
      (_, index) => {
        const key = window.localStorage.key(index)
        return key === null ? null : [key, window.localStorage.getItem(key)]
      },
    )

    act(() => vi.advanceTimersByTime(14 * 60 * 1_000))
    window.dispatchEvent(new PointerEvent("pointerdown"))
    act(() => vi.advanceTimersByTime(2 * 60 * 1_000))
    expect(appStore.getState().loadPhase).toBe("ready")
    expect(
      Array.from({ length: window.localStorage.length }, (_, index) => {
        const key = window.localStorage.key(index)
        return key === null ? null : [key, window.localStorage.getItem(key)]
      }),
    ).toEqual(persistedBeforeActivity)

    act(() => vi.advanceTimersByTime(13 * 60 * 1_000))
    expect(appStore.getState().loadPhase).toBe("locked")

    unmount()
    expect(errorSpy.mock.calls.filter(([message]) =>
      String(message).includes("The current testing environment is not configured to support act(...)"),
    )).toEqual([])
  })

  it("does not lock merely because the tab is hidden briefly", () => {
    vi.useFakeTimers()
    let visibility: DocumentVisibilityState = "visible"
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    )
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    const { unmount } = render(
      <RouterContextProvider router={router}>
        <AppStoreProvider store={appStore}>
          <AppShell>
            <h1>Panel de prueba</h1>
          </AppShell>
        </AppStoreProvider>
      </RouterContextProvider>,
    )

    visibility = "hidden"
    document.dispatchEvent(new Event("visibilitychange"))
    act(() => vi.advanceTimersByTime(30_000))
    visibility = "visible"
    document.dispatchEvent(new Event("visibilitychange"))

    expect(appStore.getState().loadPhase).toBe("ready")
    unmount()
  })

  it.each(["keydown", "pointerdown", "scroll"])("does not revive an expired session when %s arrives before a suspended timer", (eventType) => {
    vi.useFakeTimers()
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    const { unmount } = render(
      <RouterContextProvider router={router}>
        <AppStoreProvider store={appStore}>
          <AppShell><h1>Panel de prueba</h1></AppShell>
        </AppStoreProvider>
      </RouterContextProvider>,
    )

    // A suspended browser can resume with an input event before overdue timers.
    vi.setSystemTime(Date.now() + 16 * 60 * 1_000)
    act(() => window.dispatchEvent(new Event(eventType)))

    expect(appStore.getState().loadPhase).toBe("locked")
    unmount()
  })
})


it.each(["actuales", "de referencia"])("navigates category evidence for %s retaining the financial cut and granularity", async (period) => {
  resetAppStore()
  const source = normalizeDataset({ accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } }, categories: { Home: { categoryType: "EXPENSE" } }, parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
    { uuid: "current", sourceTransactionUuid: "current", date: "2025-03-02", amount: -3, category: ["Home"], comment: "keep", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    { uuid: "reference", sourceTransactionUuid: "reference", date: "2025-02-02", amount: -2, category: ["Home"], comment: "keep", sourceStatus: "UNRECONCILED", splitIndex: null, splitCount: null },
  ] }] })
  const filters = { ...createDefaultFilterState(), accountIds: ["cash"], commentSearch: "keep", dateBasis: "value" as const, periodMode: "month" as const, dateRange: { from: "2025-03-01" as const, to: "2025-03-31" as const } }
  appStore.setState({ analytics: source, filters, granularity: "week" })
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: ["/resumen"] }) })
  const navigate = vi.spyOn(router, "navigate").mockResolvedValue()
  const user = userEvent.setup()
  render(<RouterContextProvider router={router}><AppStoreProvider store={appStore}><AppShell><h1>Test</h1></AppShell></AppStoreProvider></RouterContextProvider>)
  await user.click(screen.getByText("Comparar periodos"))
  await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod")
  await user.click(screen.getByText("Contribuciones por categoría", { selector: "summary" }))
  await user.click(screen.getByRole("button", { name: `Ver apuntes ${period} de Home` }))
  expect(navigate).toHaveBeenCalledWith({ to: "/transacciones", search: { page: 1, sort: "date", direction: "desc" } })
  expect(appStore.getState().filters).toMatchObject({ ...filters, periodMode: "custom", categoryPrefixes: [["Home"]], dateRange: period === "actuales" ? filters.dateRange : { from: "2025-02-01", to: "2025-02-28" } })
  expect(appStore.getState().granularity).toBe("week")
  navigate.mockRestore()
})
