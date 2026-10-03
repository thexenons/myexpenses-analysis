import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAppStore } from "../../../../application/store/app-store/app-store.ts"
import { appStore } from "../../../../composition/app-store.ts"
import { applyFilters, createDefaultFilterState } from "../../../../domain/analytics/filters.ts"
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

    await user.click(screen.getByRole("button", { name: "Seleccionar Sin categoría" }))
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

  it("does not expose a status control or treat stale statuses as active", () => {
    appStore.setState({ filterDrawerOpen: true, filters: { ...createDefaultFilterState(), scope: "realCashFlow", statuses: ["VOID"] } })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    expect(screen.queryByRole("group", { name: "Estado" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Anuladas" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled()
  })

  it("excludes facets supplied only by VOID postings while retaining catalog categories", async () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Active: { categoryType: "EXPENSE" }, Archived: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "active", sourceTransactionUuid: "active", date: "2026-01-01", amount: -2, category: ["Active"], sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
        { uuid: "void", sourceTransactionUuid: "void", date: "2026-01-02", amount: -3, category: ["Archived"], sourceStatus: "VOID", splitIndex: null, splitCount: null },
      ] }],
    })
    Object.assign(analytics.postings[0]!, { payee: "Visible", payeeSourceId: 1, tags: ["Current"], currency: "EUR" })
    Object.assign(analytics.postings[1]!, { payee: "Hidden", payeeSourceId: 2, tags: ["Void only"], currency: "GBP" })
    appStore.setState({ analytics, filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    expect(screen.getByRole("button", { name: "Seleccionar Active" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Seleccionar Archived" })).toBeVisible()
    expect(screen.getByRole("checkbox", { name: "Current" })).toBeVisible()
    expect(screen.queryByRole("checkbox", { name: "Void only" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Seleccionar Archived" })).toHaveAttribute("aria-pressed", "false")
    await userEvent.setup().click(screen.getByText("Criterios adicionales"))
    expect(screen.getByRole("checkbox", { name: "Visible" })).toBeVisible()
    expect(screen.queryByRole("checkbox", { name: "Hidden" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "GBP" })).not.toBeInTheDocument()
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

  it("offers exact payees, missing methods, types and currencies from active postings", async () => {
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

  it("explains when neither identity facet has available options", async () => {
    appStore.setState({ filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await userEvent.setup().click(screen.getByText("Criterios adicionales"))

    const payees = within(screen.getByRole("group", { name: "Beneficiarios" }))
    const methods = within(screen.getByRole("group", { name: "Métodos de pago" }))
    expect(payees.getByRole("status")).toHaveTextContent("No hay beneficiarios disponibles.")
    expect(methods.getByRole("status")).toHaveTextContent("No hay métodos de pago disponibles.")
    expect(payees.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(methods.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it.each([
    ["Beneficiarios", "Buscar beneficiarios", "Alice", "Bob"],
    ["Métodos de pago", "Buscar métodos de pago", "Card", "Cash"],
  ])("explains unmatched %s searches while retaining selected options and restoring choices on clear", async (group, searchLabel, selectedLabel, otherLabel) => {
    const user = userEvent.setup()
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Food: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "one", date: "2026-01-01", amount: -2, category: ["Food"], sourceTransactionUuid: "one", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "two", date: "2026-01-02", amount: -3, category: ["Food"], sourceTransactionUuid: "two", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    })
    Object.assign(analytics.postings[0]!, { payee: "Alice", payeeSourceId: 1, paymentMethod: "Card", paymentMethodSourceId: 1 })
    Object.assign(analytics.postings[1]!, { payee: "Bob", payeeSourceId: 2, paymentMethod: "Cash", paymentMethodSourceId: 2 })
    appStore.setState({ analytics, filterDrawerOpen: true })
    render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
    await user.click(screen.getByText("Criterios adicionales"))

    const facet = within(screen.getByRole("group", { name: group }))
    const search = facet.getByRole("searchbox", { name: searchLabel })
    await user.type(search, "zz")
    expect(facet.getByRole("status")).toHaveTextContent("No hay coincidencias.")
    expect(facet.queryByRole("checkbox")).not.toBeInTheDocument()

    await user.clear(search)
    expect(facet.queryByRole("status")).not.toBeInTheDocument()
    expect(facet.getByRole("checkbox", { name: otherLabel })).toBeVisible()
    await user.click(facet.getByRole("checkbox", { name: selectedLabel }))
    await user.type(search, "zz")
    expect(facet.getByRole("checkbox", { name: selectedLabel })).toBeChecked()
    expect(facet.queryByRole("checkbox", { name: otherLabel })).not.toBeInTheDocument()
    expect(facet.queryByRole("status")).not.toBeInTheDocument()
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
    expect(screen.getByRole("searchbox", { name: "Buscar en comentarios" })).toHaveAttribute("placeholder", "Buscar comentarios…")
    expect(screen.getByRole("searchbox", { name: "Buscar en referencias" })).toHaveAttribute("placeholder", "Buscar referencias…")
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

it("offers accessible include and exclude category modes without an empty restriction", async () => {
  resetAppStore()
  const user = userEvent.setup()
  appStore.setState({ filterDrawerOpen: true })
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
  const mode = screen.getByRole("combobox", { name: "Modo de categorías" })
  expect(mode).toHaveValue("include")
  await user.selectOptions(mode, "exclude")
  expect(appStore.getState().filters.categoryMode).toBe("exclude")
  expect(screen.getByText(/Sin selección no se limita por categoría\./)).toBeVisible()
  expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled()
  act(() => appStore.getState().actions.setCategoryPrefixes([["Gastos"]]))
  expect(await screen.findByText("1 ruta excluida")).toBeVisible()
  await user.selectOptions(mode, "include")
  expect(appStore.getState().filters.categoryMode).toBe("include")
})

it("can exclude every owning account and retains selected IDs when modes change", async () => {
  resetAppStore()
  const user = userEvent.setup()
  const analytics = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Caja", type: "DEFAULT" } } },
    categories: {},
    parsedData: [{ uuid: "cash", label: "Caja", currency: "EUR", openingBalance: 10, transactions: [] }],
  })
  appStore.setState({ analytics, filterDrawerOpen: true })
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
  const mode = screen.getByRole("combobox", { name: "Modo de cuentas" })
  expect(mode).toHaveValue("include")
  const cash = screen.getByRole("checkbox", { name: "Caja, EUR, Efectivo" })
  expect(cash).toBeChecked()
  expect(cash).toBeDisabled()
  await user.selectOptions(mode, "exclude")
  expect(cash).not.toBeChecked()
  expect(cash).toBeEnabled()
  expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled()
  expect(mode).toHaveAccessibleDescription(/Sin selección se incluyen todas las cuentas del ámbito/)
  await user.click(cash)
  expect(appStore.getState().filters.accountIds).toEqual(["cash"])
  expect(cash).toBeChecked()
  expect(cash).toBeEnabled()
  expect(applyFilters(analytics, appStore.getState().filters).accounts).toEqual([])
  await user.selectOptions(mode, "include")
  expect(appStore.getState().filters.accountIds).toEqual(["cash"])
  await user.selectOptions(mode, "exclude")
  expect(appStore.getState().filters.accountIds).toEqual(["cash"])
  await user.click(cash)
  expect(appStore.getState().filters.accountIds).toEqual([])
  expect(applyFilters(analytics, appStore.getState().filters).accounts).toHaveLength(1)
})

it("offers accessible tag modes without creating an empty active filter", async () => {
  resetAppStore()
  const user = userEvent.setup()
  const analytics = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: { Expense: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "tagged", date: "2024-01-01", amount: -1, category: ["Expense"], tags: ["Viaje"], sourceTransactionUuid: "tagged", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    ] }],
  })
  appStore.setState({ analytics, filterDrawerOpen: true })
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
  const mode = screen.getByRole("combobox", { name: "Modo de etiquetas" })
  expect(mode).toHaveValue("include")
  await user.selectOptions(mode, "exclude")
  expect(mode).toHaveAccessibleDescription(/Sin selección no se limita por etiqueta/)
  expect(screen.getByRole("button", { name: "Restablecer" })).toBeDisabled()
  await user.click(screen.getByRole("checkbox", { name: "Viaje" }))
  expect(appStore.getState().filters).toMatchObject({ tagMode: "exclude", tags: ["Viaje"] })
  expect(applyFilters(analytics, appStore.getState().filters).postings).toEqual([])
  await user.selectOptions(mode, "include")
  expect(appStore.getState().filters.tags).toEqual(["Viaje"])
  expect(applyFilters(analytics, appStore.getState().filters).postings).toHaveLength(1)
})

it.each([
  { paths: [["A"], ["B"], ["C"]], remove: "B", target: "C", key: "{Enter}" },
  { paths: [["A"], ["B"], ["C"]], remove: "C", target: "B", key: " " },
  { paths: [["A"]], remove: "A", target: null, key: "{Enter}" },
])("keeps keyboard focus after removing drawer category $remove", async ({ paths, remove, target, key }) => {
  resetAppStore()
  const user = userEvent.setup()
  appStore.setState({ filterDrawerOpen: true })
  appStore.getState().actions.setCategoryPrefixes(paths)
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
  const removal = screen.getByRole("button", { name: `Quitar ${remove}` })
  removal.focus()
  expect(removal).toHaveFocus()
  await user.keyboard(key)
  expect(screen.queryByRole("button", { name: `Quitar ${remove}` })).toBeNull()
  const destination = target === null
    ? screen.getByRole("region", { name: "Selector de categorías" })
    : screen.getByRole("button", { name: `Quitar ${target}` })
  expect(destination).toHaveFocus()
})

it("does not steal drawer focus when another control or background reset removes categories", () => {
  resetAppStore()
  appStore.setState({ filterDrawerOpen: true })
  appStore.getState().actions.setCategoryPrefixes([["A"], ["B"]])
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
  const search = screen.getByRole("searchbox", { name: "Buscar en movimientos" })
  search.focus()
  fireEvent.click(screen.getByRole("button", { name: "Quitar A" }))
  expect(search).toHaveFocus()
  act(() => appStore.getState().actions.clearFilters())
  expect(search).toHaveFocus()
})

it.each([
  { mode: "include", depth: "subtree", expected: ["food", "groceries", "income", "uncategorized"] },
  { mode: "include", depth: "exact", expected: ["food", "income", "uncategorized"] },
  { mode: "exclude", depth: "subtree", expected: ["root"] },
  { mode: "exclude", depth: "exact", expected: ["root", "groceries"] },
] as const)("selects multiple hierarchical paths in $mode/$depth without narrowing available nodes", async ({ mode, depth, expected }) => {
  resetAppStore()
  const user = userEvent.setup()
  const analytics = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: {
      Expense: { categoryType: "EXPENSE", children: {
        Food: { categoryType: "EXPENSE", children: { Groceries: { categoryType: "EXPENSE" } } },
        Unused: { categoryType: "EXPENSE" },
      } },
      Income: { categoryType: "INCOME" },
    },
    parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0,
      transactions: [
        { uuid: "root", category: ["Expense"] },
        { uuid: "food", category: ["Expense", "Food"] },
        { uuid: "groceries", category: ["Expense", "Food", "Groceries"] },
        { uuid: "income", category: ["Income"] },
        { uuid: "uncategorized", category: ["Expense"] },
      ].map((transaction) => ({ uuid: transaction.uuid, category: transaction.category, date: "2026-01-02", amount: -1, sourceTransactionUuid: transaction.uuid, sourceStatus: "CLEARED" as const, splitIndex: null, splitCount: null })),
    }],
  })
  Object.assign(analytics.postings.find((posting) => posting.sourceTransactionId === "uncategorized")!, { categoryPath: [] })
  appStore.setState({ analytics, filterDrawerOpen: true })
  appStore.getState().actions.patchFilters({ search: "no matching posting", categoryMode: mode, categoryDepth: depth })
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>)
  expect(applyFilters(analytics, appStore.getState().filters).postings).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Seleccionar Expense › Food" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "Desplegar Expense" }))
  expect(screen.getByRole("button", { name: "Seleccionar Expense › Unused" })).toBeVisible()
  expect(screen.getByRole("button", { name: "Seleccionar Expense" })).toHaveAttribute("aria-pressed", "false")
  await user.click(screen.getByRole("button", { name: "Seleccionar Expense › Food" }))
  await user.click(screen.getByRole("button", { name: "Desplegar Expense › Food" }))
  expect(screen.getByRole("button", { name: "Seleccionar Expense › Food › Groceries" })).toHaveAttribute("aria-pressed", "false")
  await user.click(screen.getByRole("button", { name: "Seleccionar Income" }))
  await user.click(screen.getByRole("button", { name: "Seleccionar Sin categoría" }))
  expect(appStore.getState().filters.categoryPrefixes).toEqual([["Expense", "Food"], ["Income"], []])
  expect(screen.getByRole("button", { name: "Seleccionar Expense › Food" })).toHaveAttribute("aria-pressed", "true")
  await user.clear(screen.getByRole("searchbox", { name: "Buscar en movimientos" }))
  expect(applyFilters(analytics, appStore.getState().filters).postings.map((posting) => posting.sourceTransactionId)).toEqual(expected)
})

it("saves and applies named local presets with explicit overwrite/delete confirmation and keyboard focus", async () => {
  resetAppStore();
  const user = userEvent.setup();
  const analytics = normalizeDataset({ accounts: { version: 2, accounts: {} }, categories: {}, parsedData: [] });
  appStore.setState({ analytics, loadPhase: "ready", filterDrawerOpen: true, filters: { ...createDefaultFilterState(), search: "Saved text", commentSearch: "Notes" } });
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>);
  await user.click(screen.getByText("Filtros guardados"));
  await user.type(screen.getByRole("textbox", { name: "Nombre del filtro" }), "Monthly");
  await user.click(screen.getByRole("button", { name: "Guardar filtro actual" }));
  await waitFor(() => expect(screen.getByRole("option", { name: "Monthly" })).toBeInTheDocument());
  act(() => appStore.getState().actions.patchFilters({ search: "Changed", commentSearch: "" }));
  await user.click(screen.getByRole("button", { name: "Aplicar filtro guardado" }));
  await waitFor(() => expect(appStore.getState().filters.search).toBe("Saved text"));
  expect(appStore.getState().filters.commentSearch).toBe("Notes");
  await user.click(screen.getByRole("button", { name: "Sobrescribir filtro guardado" }));
  expect(screen.getByRole("group", { name: /¿Sobrescribir/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  const search = screen.getByRole("searchbox", { name: "Buscar en movimientos" });
  await user.click(search);
  act(() => appStore.getState().actions.patchFilters({ linked: "linked" }));
  expect(search).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: "Sobrescribir filtro guardado" })).toHaveFocus();
  act(() => appStore.getState().actions.patchFilters({ commentSearch: "Updated" }));
  await user.click(screen.getByRole("button", { name: "Sobrescribir filtro guardado" }));
  await user.click(screen.getByRole("button", { name: "Confirmar sobrescritura" }));
  await waitFor(() => expect(appStore.getState().filterPresets[0]?.snapshot.filters.commentSearch).toBe("Updated"));
  await user.click(screen.getByRole("button", { name: "Eliminar filtro guardado" }));
  expect(screen.getByRole("option", { name: "Monthly" })).toBeInTheDocument();
  const originalSet = Storage.prototype.setItem;
  const pendingBlur = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    // Emulate native browsers blurring the focused button when pending disables it.
    if (key === "myexpenses-analysis:filter-presets:v1" && document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    originalSet.call(this, key, value);
  });
  try {
    await user.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: "Monthly" })).toBeNull());
    expect(screen.getByRole("combobox", { name: "Filtro guardado" })).toHaveFocus();
  } finally {
    pendingBlur.mockRestore();
  }
});

it("announces preset storage errors without replacing malformed local data", async () => {
  resetAppStore();
  const user = userEvent.setup();
  window.localStorage.setItem("myexpenses-analysis:filter-presets:v1", "{");
  appStore.setState({ analytics: normalizeDataset({ accounts: { version: 2, accounts: {} }, categories: {}, parsedData: [] }), loadPhase: "ready", filterDrawerOpen: true });
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>);
  await user.click(screen.getByText("Filtros guardados"));
  await user.type(screen.getByRole("textbox", { name: "Nombre del filtro" }), "New");
  await user.click(screen.getByRole("button", { name: "Guardar filtro actual" }));
  await waitFor(() => expect(screen.getByText(/No se pueden utilizar los filtros guardados/)).toBeVisible());
  expect(window.localStorage.getItem("myexpenses-analysis:filter-presets:v1")).toBe("{");
});


it("visibly rejects a quota failure through the real preset storage adapter", async () => {
  resetAppStore();
  const user = userEvent.setup();
  appStore.setState({ analytics: normalizeDataset({ accounts: { version: 2, accounts: {} }, categories: {}, parsedData: [] }), loadPhase: "ready", filterDrawerOpen: true });
  render(<AppStoreProvider store={appStore}><FilterDrawer /></AppStoreProvider>);
  await user.click(screen.getByText("Filtros guardados"));
  await user.type(screen.getByRole("textbox", { name: "Nombre del filtro" }), "Quota");
  const originalSet = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "myexpenses-analysis:filter-presets:v1") throw new DOMException("Quota", "QuotaExceededError");
    return originalSet.call(this, key, value);
  });
  try {
    await user.click(screen.getByRole("button", { name: "Guardar filtro actual" }));
    await waitFor(() => expect(screen.getByText(/No se pudieron guardar los filtros locales/)).toBeVisible());
    expect(screen.queryByRole("option", { name: "Quota" })).toBeNull();
    expect(window.localStorage.getItem("myexpenses-analysis:filter-presets:v1")).toBeNull();
  } finally {
    write.mockRestore();
  }
});

async function pendingPresetConfirmation(kind: "delete" | "overwrite", focused = true) {
  installDialogStub();
  const values = new Map<string, string>();
  let delay = false;
  let settle: ((succeed: boolean) => void) | undefined;
  const store = createAppStore({ load: async () => { throw new Error("Unused synthetic repository"); } }, {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: async (key, value) => {
      if (delay && key === "myexpenses-analysis:filter-presets:v1") {
        await new Promise<void>((resolve, reject) => {
          settle = (succeed) => succeed ? resolve() : reject(new Error("Synthetic write failure"));
        });
      }
      values.set(key, value);
    },
  }, { hostname: "localhost", isSecureContext: true });
  store.setState({ analytics: normalizeDataset({ accounts: { version: 2, accounts: {} }, categories: {}, parsedData: [] }), loadPhase: "ready", filterDrawerOpen: true });
  await store.getState().actions.saveFilterPreset("Pending");
  const user = userEvent.setup();
  const view = render(<AppStoreProvider store={store}><FilterDrawer /></AppStoreProvider>);
  await user.click(await screen.findByText("Filtros guardados"));
  const selector = screen.getByRole("combobox", { name: "Filtro guardado" });
  await user.selectOptions(selector, "Pending");
  await user.click(screen.getByRole("button", { name: kind === "delete" ? "Eliminar filtro guardado" : "Sobrescribir filtro guardado" }));
  const confirm = screen.getByRole("button", { name: kind === "delete" ? "Confirmar eliminación" : "Confirmar sobrescritura" });
  const search = screen.getByRole("searchbox", { name: "Buscar en movimientos" });
  delay = true;
  if (focused) {
    confirm.focus();
    await user.keyboard("{Enter}");
  } else {
    search.focus();
    fireEvent.click(confirm);
  }
  await waitFor(() => expect(settle).toBeTypeOf("function"));
  expect(confirm).toBeDisabled();
  return { store, view, user, confirm, selector, search, settle: async (succeed = true) => {
    await act(async () => { settle!(succeed); });
    await waitFor(() => expect(store.getState().presetBusy).toBe(false));
  } };
}

function forcePendingBodyFocus(confirm: HTMLElement) {
  // jsdom ignores blur() on disabled buttons: temporarily enable only for a genuine blur.
  const button = confirm as HTMLButtonElement;
  button.disabled = false;
  button.blur();
  button.disabled = true;
  expect(document.activeElement).toBe(document.body);
}

it.each(["delete", "overwrite"] as const)("restores owned confirmation focus after genuine pending BODY blur on %s", async (kind) => {
  const pending = await pendingPresetConfirmation(kind);
  forcePendingBodyFocus(pending.confirm);
  await pending.settle();
  expect(pending.confirm).not.toBeInTheDocument();
  expect(pending.selector).toHaveFocus();
});

it.each(["focus", "focus-then-body", "pointer", "keyboard", "closed", "disconnected", "unfocused"] as const)("does not reclaim preset confirmation focus after %s", async (redirect) => {
  const pending = await pendingPresetConfirmation("delete", redirect !== "unfocused");
  if (redirect !== "unfocused") forcePendingBodyFocus(pending.confirm);
  if (redirect === "focus" || redirect === "focus-then-body") pending.search.focus();
  if (redirect === "focus-then-body") pending.search.blur();
  if (redirect === "pointer") fireEvent.pointerDown(document.body);
  if (redirect === "keyboard") fireEvent.keyDown(document.body, { key: "Tab" });
  if (redirect === "closed") await act(async () => { pending.store.getState().actions.closeFilterDrawer(); });
  if (redirect === "disconnected") pending.view.unmount();
  const destination = document.activeElement;
  await pending.settle();
  expect(document.activeElement).toBe(destination);
});

it("restores an owned failed confirmation after pending blur without closing it", async () => {
  const pending = await pendingPresetConfirmation("delete");
  forcePendingBodyFocus(pending.confirm);
  await pending.settle(false);
  expect(pending.confirm).toHaveFocus();
  expect(pending.confirm).toBeEnabled();
  expect(screen.getByText(/No se pudieron guardar los filtros locales/)).toBeVisible();
});


it("does not steal external focus when a pending confirmation fails", async () => {
  const pending = await pendingPresetConfirmation("delete");
  forcePendingBodyFocus(pending.confirm);
  pending.search.focus();
  await pending.settle(false);
  expect(pending.search).toHaveFocus();
  expect(pending.confirm).toBeEnabled();
});
