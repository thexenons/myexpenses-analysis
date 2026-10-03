import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import periodCss from "../PeriodSelector/PeriodSelector.module.css?raw"
import { GlobalFilters } from "./GlobalFilters"
import toolbarCss from "./GlobalFilters.module.css?raw"

function resetAppStore() {
  window.localStorage.clear()
  appStore.setState(appStore.getInitialState(), true)
}

describe("GlobalFilters", () => {
  beforeEach(resetAppStore)

  it("keeps time controls in the mobile toolbar while moving quick search into the drawer", () => {
    // Static CSS contract: jsdom does not calculate responsive layout.
    const tablet = toolbarCss.split("@media (width <= 52rem)")[1]?.split("@media (width <= 42rem)")[0]
    const phone = toolbarCss.split("@media (width <= 42rem)")[1]
    const narrowPeriod = periodCss.split("@media (width <= 32rem)")[1]

    expect(tablet).toMatch(/\.search\s*\{\s*display:\s*none;/)
    expect(tablet).not.toMatch(/\.(?:period|granularity)[^{]*\{[^}]*display:\s*none;/)
    expect(phone).toMatch(/\.period\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/)
    expect(phone).toMatch(/\.granularity\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/)
    expect(phone).toMatch(/\.scope\s*\{[^}]*grid-row:\s*3;/)
    expect(phone).toMatch(/\.drawerButton\s*\{[^}]*grid-row:\s*3;/)
    expect(narrowPeriod).toMatch(/\.root\[data-variant="compact"\]\s*>\s*\.customFields\s*,/)
    expect(narrowPeriod).toMatch(/flex-basis:\s*100%;/)
  })

  it("orders perspectives, defaults to cash flow, and removes a manual Yo selection", async () => {
    const user = userEvent.setup()
    render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)

    const perspectives = within(screen.getByRole("group", { name: "Ámbito de las estadísticas" }))
    expect(perspectives.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "realCashFlow", "all", "debtsOnly",
    ])
    expect(perspectives.getByRole("radio", { name: "Flujo real" })).toBeChecked()
    expect(perspectives.getByRole("radio", { name: "Yo" })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()

    await user.click(perspectives.getByRole("radio", { name: "Yo" }))
    expect(appStore.getState().filters.scope).toBe("all")
    expect(screen.getByRole("button", { name: "Abrir todos los filtros, 1 activo" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Quitar filtro Yo" }))
    expect(appStore.getState().filters.scope).toBe("realCashFlow")
    expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()
  })

  it("updates global search, scope and granularity from accessible controls", async () => {
    const user = userEvent.setup()
    render(
      <AppStoreProvider store={appStore}>
        <GlobalFilters />
      </AppStoreProvider>,
    )

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en todos los movimientos" }),
      "alquiler",
    )
    await user.click(screen.getByRole("radio", { name: "Flujo real" }))
    await user.click(screen.getByRole("radio", { name: "Día" }))

    expect(appStore.getState().filters.search).toBe("alquiler")
    expect(appStore.getState().filters.scope).toBe("realCashFlow")
    expect(appStore.getState().granularity).toBe("day")
  })

  it("opens the advanced filter drawer and announces the active count", async () => {
    const user = userEvent.setup()
    render(
      <AppStoreProvider store={appStore}>
        <GlobalFilters />
      </AppStoreProvider>,
    )

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en todos los movimientos" }),
      "nómina",
    )
    const openButton = screen.getByRole("button", {
      name: "Abrir todos los filtros, 1 activo",
    })
    await user.click(openButton)

    expect(appStore.getState().filterDrawerOpen).toBe(true)
  })

  it("selects a concrete month independently from chart granularity", async () => {
    const user = userEvent.setup()
    render(
      <AppStoreProvider store={appStore}>
        <GlobalFilters />
      </AppStoreProvider>,
    )

    await user.selectOptions(screen.getByLabelText("Tipo de periodo"), "month")
    fireEvent.change(screen.getByLabelText("Mes seleccionado"), {
      target: { value: "2026-04" },
    })

    expect(appStore.getState().filters).toMatchObject({
      periodMode: "month",
      dateRange: { from: "2026-04-01", to: "2026-04-30" },
    })
    expect(appStore.getState().granularity).toBe("auto")
  })

  it("keeps both custom date boundaries and granularity reachable in the compact toolbar", async () => {
    const user = userEvent.setup()
    render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)

    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de periodo" }), "custom")
    expect(screen.getByLabelText("Desde")).toHaveAttribute("type", "date")
    expect(screen.getByLabelText("Hasta")).toHaveAttribute("type", "date")
    await user.click(screen.getByRole("radio", { name: "Semana" }))

    expect(appStore.getState().filters.periodMode).toBe("custom")
    expect(appStore.getState().granularity).toBe("week")
    expect(screen.getByRole("button", { name: /^Abrir todos los filtros/ })).toBeVisible()
  })

  it("announces and independently clears the new filter dimensions", async () => {
    const user = userEvent.setup()
    appStore.getState().actions.patchFilters({ originAccountIds: ["cash"], destinationAccountIds: ["partner"], dateBasis: "value", categoryDepth: "exact", categoryMatch: "either" })
    render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)
    expect(screen.getByRole("button", { name: "Abrir todos los filtros, 5 activos" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Quitar filtro Fecha valor" }))
    expect(appStore.getState().filters.dateBasis).toBe("operation")
    expect(appStore.getState().filters.destinationAccountIds).toEqual(["partner"])
    expect(screen.getByRole("button", { name: "Abrir todos los filtros, 4 activos" })).toBeVisible()
  })

  it("counts new dimensions and exposes concrete chips without exposing obsolete status", async () => {
    const user = userEvent.setup()
    appStore.getState().actions.patchFilters({
      search: "viaje", statuses: ["CLEARED", "VOID"], payeeKeys: ['["source",10]'],
      paymentMethodKeys: ['["missing"]'], categoryTypes: ["NEUTRAL"], currencies: ["EUR"],
      minAmountEurMinor: 0, maxAmountEurMinor: 125, commentSearch: "nota", referenceSearch: "abc",
    })
    render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)
    expect(screen.getByRole("button", { name: "Abrir todos los filtros, 8 activos" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /Quitar filtro Estados:/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Quitar filtro Texto: viaje" }))
    await user.click(screen.getByRole("button", { name: /Quitar filtro Importe absoluto ≥ 0,00 EUR/ }))
    expect(appStore.getState().filters.search).toBe("")
    expect(appStore.getState().filters.minAmountEurMinor).toBeNull()
    expect(appStore.getState().filters.maxAmountEurMinor).toBe(125)
    expect(screen.getByRole("button", { name: "Abrir todos los filtros, 7 activos" })).toBeVisible()
  })

  it("uses a human label on an unambiguous exact-identity chip", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Caja", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Caja", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "one", date: "2026-01-01", amount: -2, category: ["Gastos"], sourceTransactionUuid: "one", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    })
    Object.assign(analytics.postings[0]!, { payee: "Único", payeeSourceId: 42 })
    appStore.setState({ analytics })
    appStore.getState().actions.patchFilters({ payeeKeys: ['["source",42]'] })
    render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)
    expect(screen.getByRole("button", { name: "Quitar filtro Beneficiario: Único" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /Beneficiario: Único \(ID 42\)/ })).toBeNull()
  })
})

describe("excluded category chips", () => {
  beforeEach(resetAppStore)
  it("labels excluded paths explicitly without counting an empty mode", async () => {
    const user = userEvent.setup()
    appStore.getState().actions.patchFilters({ categoryMode: "exclude" })
    render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)
    expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()
    expect(screen.queryByRole("list", { name: "Filtros aplicados" })).toBeNull()
    act(() => appStore.getState().actions.patchFilters({ categoryPrefixes: [["Gastos"], ["Ingresos"]] }))
    const first = await screen.findByRole("button", { name: "Quitar filtro Excluir: Gastos" })
    expect(screen.getByRole("button", { name: "Abrir todos los filtros, 1 activo" })).toBeVisible()
    await user.click(first)
    expect(appStore.getState().filters.categoryPrefixes).toEqual([["Ingresos"]])
    expect(appStore.getState().filters.categoryMode).toBe("exclude")
    await user.click(screen.getByRole("button", { name: "Quitar filtro Excluir: Ingresos" }))
    expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()
  })
})

it("labels only owning account exclusions and ignores an empty exclusion mode", async () => {
  resetAppStore()
  const user = userEvent.setup()
  appStore.getState().actions.patchFilters({ accountMode: "exclude" })
  render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)
  expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()
  act(() => appStore.getState().actions.patchFilters({ accountIds: ["cash"], originAccountIds: ["cash"] }))
  expect(screen.getByRole("button", { name: "Quitar filtro Excluir cuenta: Cuenta no disponible" })).toBeVisible()
  expect(screen.getByRole("button", { name: "Abrir todos los filtros, 2 activos" })).toBeVisible()
  expect(screen.getByRole("button", { name: "Quitar filtro Origen: Cuenta no disponible" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Quitar filtro Excluir cuenta: Cuenta no disponible" }))
  expect(appStore.getState().filters.accountIds).toEqual([])
  expect(appStore.getState().filters.accountMode).toBe("exclude")
})

it("labels excluded tags explicitly and does not count an empty tag mode", async () => {
  resetAppStore()
  const user = userEvent.setup()
  appStore.getState().actions.patchFilters({ tagMode: "exclude" })
  render(<AppStoreProvider store={appStore}><GlobalFilters /></AppStoreProvider>)
  expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()
  act(() => appStore.getState().actions.setTags(["Viaje", "Trabajo"]))
  expect(screen.getByRole("button", { name: "Abrir todos los filtros, 1 activo" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Quitar filtro Excluir etiqueta: Viaje" }))
  expect(appStore.getState().filters.tags).toEqual(["Trabajo"])
  expect(appStore.getState().filters.tagMode).toBe("exclude")
  await user.click(screen.getByRole("button", { name: "Quitar filtro Excluir etiqueta: Trabajo" }))
  expect(screen.getByRole("button", { name: "Abrir todos los filtros" })).toBeVisible()
})
