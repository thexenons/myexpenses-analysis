import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { appStore } from "../../../../composition/app-store.ts"
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts"
import { GlobalFilters } from "./GlobalFilters"

function resetAppStore() {
  window.localStorage.clear()
  appStore.setState(appStore.getInitialState(), true)
}

describe("GlobalFilters", () => {
  beforeEach(resetAppStore)

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
})
