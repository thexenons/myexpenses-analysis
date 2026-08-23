import {
  createMemoryHistory,
  RouterContextProvider,
} from "@tanstack/react-router"
import { render, screen, waitFor, within } from "@testing-library/react"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  afterEach(() => vi.useRealTimers())

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
})
