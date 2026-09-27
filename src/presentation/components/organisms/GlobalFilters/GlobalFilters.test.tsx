import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
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
})
