import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
import { createDefaultFilterState } from "../../../../domain/analytics/filters.ts"
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import { FilterDrawer } from "./FilterDrawer"

function installDialogStub() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true
      this.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") {
            this.dispatchEvent(
              new Event("cancel", { bubbles: true, cancelable: true }),
            )
          }
        },
        { once: true },
      )
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

function resetAppStore() {
  window.localStorage.clear()
  appStore.setState(appStore.getInitialState(), true)
  installDialogStub()
}

describe("FilterDrawer", () => {
  beforeEach(resetAppStore)

  it("closes with Escape and restores focus to the opener", async () => {
    const user = userEvent.setup()
    const opener = document.createElement("button")
    opener.textContent = "Abrir"
    document.body.append(opener)
    opener.focus()
    appStore.setState({ filterDrawerOpen: true })

    render(
      <AppStoreProvider store={appStore}>
        <FilterDrawer />
      </AppStoreProvider>,
    )
    const dialog = screen.getByRole("dialog", { name: "Filtros del análisis" })
    await waitFor(() => expect(dialog).toHaveAttribute("open"))
    expect(screen.getByRole("button", { name: "Cerrar filtros" })).toHaveFocus()

    await user.keyboard("{Escape}")

    await waitFor(() => expect(appStore.getState().filterDrawerOpen).toBe(false))
    expect(dialog).not.toHaveAttribute("open")
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it("applies and resets drawer filters through the store actions", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(
      <AppStoreProvider store={appStore}>
        <FilterDrawer />
      </AppStoreProvider>,
    )

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en movimientos" }),
      "viaje",
    )
    await user.click(screen.getByRole("radio", { name: "Solo deudas" }))
    await user.click(screen.getByRole("radio", { name: "Año" }))

    expect(appStore.getState().filters.search).toBe("viaje")
    expect(appStore.getState().filters.scope).toBe("debtsOnly")
    expect(appStore.getState().granularity).toBe("year")

    await user.click(screen.getByRole("button", { name: "Restablecer" }))

    expect(appStore.getState().filters.search).toBe("")
    expect(appStore.getState().filters.scope).toBe("all")
    expect(appStore.getState().granularity).toBe("month")
  })

  it("exposes the cleared audit status without flattening it into reconciled", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(
      <AppStoreProvider store={appStore}>
        <FilterDrawer />
      </AppStoreProvider>,
    )

    await user.click(screen.getByRole("checkbox", { name: "Compensadas" }))

    expect(appStore.getState().filters.statuses).toEqual([
      "UNRECONCILED",
      "RECONCILED",
      "VOID",
    ])
  })

  it("removes an exact nested category from the shared global filter", async () => {
    const user = userEvent.setup()
    appStore.setState({
      filterDrawerOpen: true,
      filters: {
        ...createDefaultFilterState(),
        categoryPrefixes: [["Gastos", "Comida"]],
      },
    })
    render(
      <AppStoreProvider store={appStore}>
        <FilterDrawer />
      </AppStoreProvider>,
    )

    await user.click(
      screen.getByRole("button", { name: "Quitar Gastos › Comida" }),
    )

    expect(appStore.getState().filters.categoryPrefixes).toEqual([])
  })

  it("closes when the non-panel overlay is pressed", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(
      <AppStoreProvider store={appStore}>
        <FilterDrawer />
      </AppStoreProvider>,
    )

    await user.click(
      screen.getByRole("button", {
        name: "Cerrar filtros al pulsar fuera del panel",
      }),
    )

    await waitFor(() => expect(appStore.getState().filterDrawerOpen).toBe(false))
  })

  it("shows only accounts compatible with the selected scope", async () => {
    const user = userEvent.setup()
    appStore.setState({
      analytics: normalizeDataset({
        accounts: {
          version: 2,
          accounts: {
            cash: { label: "Caja", type: "DEFAULT" },
            debt: { label: "Persona", type: "DEBT" },
          },
        },
        categories: {},
        parsedData: [
          {
            uuid: "cash",
            label: "Caja",
            currency: "EUR",
            openingBalance: 0,
            transactions: [],
          },
          {
            uuid: "debt",
            label: "Persona",
            currency: "EUR",
            openingBalance: 0,
            transactions: [],
          },
        ],
      }),
      filterDrawerOpen: true,
    })
    appStore.getState().actions.setAccountIds(["cash"])
    render(
      <AppStoreProvider store={appStore}>
        <FilterDrawer />
      </AppStoreProvider>,
    )

    await user.click(screen.getByRole("radio", { name: "Solo deudas" }))

    expect(screen.getByRole("checkbox", { name: /Persona, EUR, Deuda/ })).toBeVisible()
    expect(screen.queryByRole("checkbox", { name: /Caja, EUR, Efectivo/ })).toBeNull()
    expect(appStore.getState().filters.accountIds).toEqual([])
  })
})
