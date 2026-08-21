import {
  createMemoryHistory,
  RouterContextProvider,
} from "@tanstack/react-router"
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import { createAppRouter } from "../../../router/app-router.ts"
import { AppShell } from "./AppShell"

function resetAppStore() {
  window.localStorage.clear()
  appStore.setState(appStore.getInitialState(), true)
}

describe("AppShell", () => {
  beforeEach(resetAppStore)

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
    expect(within(main).getByRole("heading", { name: "Panel de prueba" })).toBeVisible()
    expect(screen.getByRole("navigation", { name: "Secciones principales" })).toBeVisible()
    expect(screen.getByRole("region", { name: "Filtros globales" })).toBeVisible()
  })
})
