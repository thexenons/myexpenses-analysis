import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { appStore } from "../../composition/app-store.ts"
import { getAxeViolations } from "../../../tests/setup/axe.ts"
import { AppStoreProvider } from "../providers/AppStoreProvider/index.ts"
import { createAppRouter } from "../router/app-router.ts"
import {
  APP_TEST_PASSPHRASE,
  installAppFetchMock,
} from "./App.test.helpers.ts"

function installDialogStub(): void {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event("close"))
    },
  })
}

describe("App accessibility", () => {
  beforeEach(() => {
    window.localStorage.clear()
    appStore.setState(appStore.getInitialState(), true)
    installDialogStub()
  })

  afterEach(() => vi.unstubAllGlobals())

  it("keeps every route and the filter dialog free of detectable WCAG violations", async () => {
    installAppFetchMock()
    const user = userEvent.setup()
    const history = createMemoryHistory({ initialEntries: ["/resumen"] })
    const router = createAppRouter({ history })
    render(
      <AppStoreProvider store={appStore}>
        <RouterProvider router={router} />
      </AppStoreProvider>,
    )

    expect(
      await screen.findByRole("heading", { name: "Abrir el libro cifrado" }),
    ).toBeVisible()
    expect(await getAxeViolations(document)).toEqual([])

    await user.type(
      screen.getByLabelText("Frase de desbloqueo"),
      APP_TEST_PASSPHRASE,
    )
    await user.click(screen.getByRole("button", { name: "Abrir bóveda" }))
    expect(
      await screen.findByRole("heading", { level: 1, name: "Resumen general" }),
    ).toBeVisible()
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus())
    expect(await getAxeViolations(document)).toEqual([])

    const routes = [
      ["Flujo de caja", "Flujo de caja"],
      ["Deudas", "Deudas"],
      ["Presupuestos", "Presupuestos"],
      ["Categorías", "Categorías"],
      ["Cuentas", "Cuentas"],
      ["Patrones y calidad", "Patrones y calidad"],
      ["Transacciones", "Transacciones"],
    ] as const

    for (const [navigationName, headingName] of routes) {
      // oxlint-disable-next-line no-await-in-loop -- Each audit requires the preceding route transition to finish.
      await user.click(screen.getByRole("link", { name: navigationName }))
      // oxlint-disable-next-line no-await-in-loop -- Lazy route content must mount before axe inspects it.
      const heading = await screen.findByRole("heading", {
        level: 1,
        name: headingName,
      })
      expect(heading).toBeVisible()
      // oxlint-disable-next-line no-await-in-loop -- The shared document is intentionally audited one route at a time.
      expect(await getAxeViolations(document)).toEqual([])
    }

    await user.click(
      screen.getByRole("button", { name: /abrir todos los filtros/i }),
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Filtros del análisis",
    })
    expect(await getAxeViolations(dialog)).toEqual([])
  }, 60_000)
})
