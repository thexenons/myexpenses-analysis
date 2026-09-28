import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { KpiCard } from "./KpiCard"

describe("KpiCard", () => {
  it("shows an unavailable value without exposing a fabricated numeric datum", () => {
    render(<KpiCard emptyValue="Sin límite global" label="Utilización" value={null} />)

    const card = screen.getByRole("article", { name: "Utilización" })
    expect(card).toHaveTextContent("Sin límite global")
    expect(card.querySelector("data")).toBeNull()
  })

  it("keeps a genuine numeric zero machine-readable", () => {
    render(<KpiCard formatValue={new Intl.NumberFormat("es-ES", { style: "percent" })} label="Utilización" value={0} />)

    const datum = screen.getByRole("article", { name: "Utilización" }).querySelector("data")
    expect(datum).toHaveAttribute("value", "0")
    expect(datum).toHaveTextContent(/0\s*%/)
  })
  it("formats its value and exposes trend direction in text", () => {
    render(
      <KpiCard
        formatValue={(value) => `${value.toFixed(2)} €`}
        label="Flujo de caja"
        trend={{ direction: "up", label: "frente al periodo anterior", value: 12 }}
        value={149.2}
      />,
    )

    expect(screen.getByText("149.20 €")).toBeVisible()
    expect(screen.getByRole("article", { name: "Flujo de caja" })).toBeVisible()
    expect(screen.getByText("Sube")).toBeInTheDocument()
    expect(screen.getByText("frente al periodo anterior")).toBeVisible()
  })
})
