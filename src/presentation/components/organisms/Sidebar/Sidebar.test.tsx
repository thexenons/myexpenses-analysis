import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import { createAppRouter } from "../../../router/app-router.ts"

function resetAppStore() {
  window.localStorage.clear()
  appStore.setState(appStore.getInitialState(), true)
  appStore.setState({ loadPhase: "ready" })
}

describe("Sidebar", () => {
  beforeEach(resetAppStore)

  it("navigates with links and announces click and history changes", async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn<() => void>()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    render(
      <AppStoreProvider store={appStore}>
        <RouterProvider router={router} />
      </AppStoreProvider>,
    )

    const navigation = await screen.findByRole("navigation", {
      name: "Secciones principales",
    })
    expect(navigation).toBeVisible()
    expect(within(navigation).getAllByRole("link")).toHaveLength(8)
    expect(screen.getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "aria-current",
      "page",
    )

    await user.click(screen.getByRole("link", { name: "Flujo de caja" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/flujo-de-caja")
    })
    expect(screen.getByRole("link", { name: "Flujo de caja" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(document.getElementById("main-content")).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" })
    expect(screen.getByText("Sección actual: Flujo de caja")).toBeInTheDocument()

    screen.getByRole("link", { name: "Flujo de caja" }).focus()
    await act(async () => router.history.back())

    expect(document.getElementById("main-content")).toHaveFocus()
    expect(screen.getByText("Sección actual: Resumen")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Bloquear bóveda" }))
    expect(appStore.getState().loadPhase).toBe("locked")
    expect(appStore.getState().analytics).toBeNull()
  })
})
