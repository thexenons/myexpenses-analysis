import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
import { createDefaultFilterState } from "../../../../domain/analytics/filters.ts"
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import { FilterDrawer } from "./FilterDrawer"
import { formatAbsoluteEurMinor, parseAbsoluteEurMinor } from "./FilterDrawer.helpers"

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

  it("parses safe two-decimal absolute EUR amounts without float cent rounding", () => {
    expect(parseAbsoluteEurMinor("")).toBeNull()
    expect(parseAbsoluteEurMinor("0")).toBe(0)
    expect(parseAbsoluteEurMinor("1,25")).toBe(125)
    expect(parseAbsoluteEurMinor("1.2")).toBe(120)
    for (const invalid of ["-1", "1.234", "NaN", "1e3", "999999999999999999999999"]) {
      expect(parseAbsoluteEurMinor(invalid)).toBeUndefined()
    }
    expect(formatAbsoluteEurMinor(Number.MAX_SAFE_INTEGER - 1)).toBe("90071992547409,90")
    expect(parseAbsoluteEurMinor(formatAbsoluteEurMinor(Number.MAX_SAFE_INTEGER - 1))).toBe(Number.MAX_SAFE_INTEGER - 1)
  })

  it("shows the requested perspective order and resets manual Yo to Flujo real", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)

    const perspectives = within(screen.getByRole("group", { name: "Ámbito de las estadísticas" }))
    expect(perspectives.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "realCashFlow", "all", "debtsOnly",
    ])
    expect(perspectives.getByRole("radio", { name: "Flujo real" })).toBeChecked()
    expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled()

    await user.click(perspectives.getByRole("radio", { name: "Yo" }))
    expect(appStore.getState().filters.scope).toBe("all")
    expect(screen.getByRole("button", { name: "Restablecer" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Restablecer" }))
    expect(appStore.getState().filters.scope).toBe("realCashFlow")
    expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled()
  })

  it("can select and remove uncategorized postings without selecting every category", async () => {
    const user = userEvent.setup()
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "uncategorized", date: "2026-01-02", amount: -20, category: ["Gastos"], sourceTransactionUuid: "uncategorized", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    })
    const analytics = structuredClone(initial)
    for (const posting of analytics.postings) Object.assign(posting, { categoryPath: [] })
    appStore.setState({ analytics, filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)

    await user.selectOptions(screen.getByRole("combobox", { name: "Añadir categoría o subcategoría" }), "[]")
    expect(appStore.getState().filters.categoryPrefixes).toEqual([[]])
    await user.click(screen.getByRole("button", { name: "Quitar Sin categoría" }))
    expect(appStore.getState().filters.categoryPrefixes).toEqual([])
  })

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
    await user.click(
      within(
        screen.getByRole("group", {
          name: "Granularidad de estadísticas y gráficas",
        }),
      ).getByRole("radio", { name: "Año" }),
    )

    expect(appStore.getState().filters.search).toBe("viaje")
    expect(appStore.getState().filters.scope).toBe("debtsOnly")
    expect(appStore.getState().granularity).toBe("year")

    await user.click(screen.getByRole("button", { name: "Restablecer" }))

    expect(appStore.getState().filters.search).toBe("")
    expect(appStore.getState().filters.scope).toBe("realCashFlow")
    expect(appStore.getState().granularity).toBe("auto")
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

  it("keeps direction filters independent of scope and exposes date and category modes", async () => {
    const user = userEvent.setup()
    appStore.setState({
      analytics: normalizeDataset({
        accounts: { version: 2, accounts: { cash: { label: "Caja", type: "DEFAULT" }, debt: { label: "Persona", type: "DEBT" } } },
        categories: {},
        parsedData: [
          { uuid: "cash", label: "Caja", currency: "EUR", openingBalance: 0, transactions: [] },
          { uuid: "debt", label: "Persona", currency: "EUR", openingBalance: 0, transactions: [] },
        ],
      }),
      filterDrawerOpen: true,
    })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByRole("checkbox", { name: "Cuenta de origen: Caja, EUR" }))
    await user.click(screen.getByRole("checkbox", { name: "Cuenta de destino: Persona, EUR" }))
    await user.click(screen.getByRole("radio", { name: "Solo deudas" }))
    await user.click(screen.getByRole("radio", { name: "Valor" }))
    await user.click(screen.getByRole("radio", { name: "Solo ruta exacta" }))
    await user.click(screen.getByRole("checkbox", { name: "También buscar la categoría en la contrapartida vinculada" }))
    expect(appStore.getState().filters).toMatchObject({ scope: "debtsOnly", originAccountIds: ["cash"], destinationAccountIds: ["debt"], dateBasis: "value", categoryMatch: "either", categoryDepth: "exact" })
    expect(screen.getByRole("checkbox", { name: "Persona, EUR, Deuda" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Restablecer" }))
    expect(appStore.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" })
  })

  it("does not turn the last selected status into all statuses", () => {
    appStore.setState({ filterDrawerOpen: true, filters: { ...createDefaultFilterState(), statuses: ["CLEARED"] } })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    expect(screen.getByRole("checkbox", { name: "Compensadas" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Anuladas" })).not.toBeChecked()
  })

  it("offers exact payees, missing methods, types and currencies from the full dataset", async () => {
    const user = userEvent.setup()
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Caja", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Caja", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "one", date: "2026-01-01", amount: -2, category: ["Gastos"], sourceTransactionUuid: "one", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "two", date: "2026-01-02", amount: -3, category: ["Gastos"], sourceTransactionUuid: "two", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "three", date: "2026-01-03", amount: -4, category: ["Gastos"], sourceTransactionUuid: "three", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "four", date: "2026-01-04", amount: -5, category: ["Gastos"], sourceTransactionUuid: "four", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    })
    Object.assign(analytics.postings[0]!, { payee: "Duplicado", payeeSourceId: 10, paymentMethod: undefined, categoryType: "EXPENSE", currency: "EUR" })
    Object.assign(analytics.postings[1]!, { payee: "Duplicado", payeeSourceId: 20, paymentMethod: "Tarjeta", paymentMethodSourceId: 4, categoryType: "INCOME", currency: "USD" })
    Object.assign(analytics.postings[2]!, { payee: "", payeeSourceId: 77, paymentMethod: undefined, categoryType: "NEUTRAL", currency: "GBP" })
    Object.assign(analytics.postings[3]!, { payee: undefined, paymentMethod: undefined, categoryType: "TRANSFER", currency: "EUR" })
    appStore.setState({ analytics, filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)

    await user.click(screen.getByText("Criterios adicionales"))
    const payees = within(screen.getByRole("group", { name: "Beneficiarios" }))
    expect(payees.getByRole("checkbox", { name: "Duplicado (ID 10)" })).toBeVisible()
    expect(payees.getByRole("checkbox", { name: "Duplicado (ID 20)" })).toBeVisible()
    expect(payees.getByRole("checkbox", { name: "Sin nombre (ID 77)" })).toBeVisible()
    expect(payees.getByRole("checkbox", { name: "Sin beneficiario" })).toBeVisible()
    expect(within(screen.getByRole("group", { name: "Métodos de pago" })).getByRole("checkbox", { name: "Tarjeta" })).toBeVisible()
    await user.click(payees.getByRole("checkbox", { name: "Duplicado (ID 10)" }))
    await user.click(within(screen.getByRole("group", { name: "Métodos de pago" })).getByRole("checkbox", { name: "Sin método de pago" }))
    await user.click(screen.getByRole("checkbox", { name: "Ingreso" }))
    await user.click(screen.getByRole("checkbox", { name: "USD" }))
    expect(appStore.getState().filters).toMatchObject({
      payeeKeys: ['["source",10]'], paymentMethodKeys: ['["missing"]'], categoryTypes: ["INCOME"], currencies: ["USD"],
    })
    expect(payees.getByRole("checkbox", { name: "Duplicado (ID 20)" })).toBeVisible()
  })

  it("keeps invalid and intermediate EUR amount edits visible but unapplied, then syncs external reset", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByText("Criterios adicionales"))
    const min = screen.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" })
    const max = screen.getByRole("textbox", { name: "Importe absoluto máximo (EUR)" })
    await user.type(min, "0")
    expect(appStore.getState().filters.minAmountEurMinor).toBe(0)
    await user.type(max, "1,25")
    expect(appStore.getState().filters.maxAmountEurMinor).toBe(125)
    await user.clear(min)
    await user.type(min, "2")
    expect(min).toHaveValue("2")
    expect(screen.getByText(/rango no aplicado/i)).toBeVisible()
    expect(appStore.getState().filters.minAmountEurMinor).toBeNull()
    await user.clear(min)
    await user.type(min, "-1")
    expect(appStore.getState().filters.minAmountEurMinor).toBeNull()
    expect(screen.getByText(/rango no aplicado/i)).toBeVisible()
    await user.clear(min)
    await user.type(min, "1.234")
    expect(appStore.getState().filters.minAmountEurMinor).toBe(123)
    expect(screen.getByText(/rango no aplicado/i)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Restablecer" }))
    await waitFor(() => expect(min).toHaveValue(""))
    expect(max).toHaveValue("")
    expect(screen.queryByText(/rango no aplicado/i)).toBeNull()
    await user.type(min, "-1")
    appStore.getState().actions.clearFilters()
    await waitFor(() => expect(min).toHaveValue(""))
  })

  it("keeps a selected source ID with no label clearable after a dataset change", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true, filters: { ...createDefaultFilterState(), payeeKeys: ['["source",77]'] } })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByText("Criterios adicionales"))
    const checkbox = within(screen.getByRole("group", { name: "Beneficiarios" })).getByRole("checkbox", { name: /Sin nombre \(ID 77\)/ })
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    expect(appStore.getState().filters.payeeKeys).toEqual([])
  })

  it("combines separate comment and reference text without changing global search", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByText("Criterios adicionales"))
    await user.type(screen.getByRole("searchbox", { name: "Buscar en comentarios" }), "café")
    await user.type(screen.getByRole("searchbox", { name: "Buscar en referencias" }), "factura")
    expect(appStore.getState().filters).toMatchObject({ commentSearch: "café", referenceSearch: "factura", search: "" })
    await user.click(screen.getByRole("button", { name: "Restablecer" }))
    expect(appStore.getState().filters).toEqual({ ...createDefaultFilterState(), scope: "realCashFlow" })
  })

  it("can reset a rejected amount even when no valid filter was applied", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByText("Criterios adicionales"))
    const min = screen.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" })
    await user.type(min, "-1")
    expect(screen.getByRole("button", { name: "Restablecer" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Restablecer" }))
    expect(min).toHaveValue("")
    expect(appStore.getState().filters.minAmountEurMinor).toBeNull()
  })

  it("preserves a rejected amount draft across unrelated criteria and clears it on explicit reset or lock", async () => {
    const user = userEvent.setup()
    appStore.setState({ filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByText("Criterios adicionales"))
    const min = screen.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" })
    await user.type(min, "-1")
    await user.type(screen.getByRole("searchbox", { name: "Buscar en comentarios" }), "nota")
    await user.click(screen.getByRole("checkbox", { name: "Neutral" }))
    expect(min).toHaveValue("-1")
    expect(screen.getByText(/Rango no aplicado/)).toBeVisible()
    appStore.getState().actions.clearFilters()
    await waitFor(() => expect(min).toHaveValue(""))
    await user.type(min, "-2")
    appStore.getState().actions.lock()
    await waitFor(() => expect(min).toHaveValue(""))
  })
})
