import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "./EmptyState"

describe("EmptyState", () => {
  it("explains the empty result and keeps its recovery action usable", async () => {
    const user = userEvent.setup()
    const onReset = vi.fn<() => void>()
    render(
      <EmptyState
        actions={<button onClick={onReset}>Restablecer filtros</button>}
        description="Amplía el periodo para ver movimientos."
        title="Sin resultados"
      />,
    )

    expect(screen.getByRole("heading", { name: "Sin resultados" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Restablecer filtros" }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("can preserve page heading order when it is the primary empty state", () => {
    render(<EmptyState headingLevel={2} title="Sin presupuesto" />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Sin presupuesto" }),
    ).toBeVisible()
  })
})
