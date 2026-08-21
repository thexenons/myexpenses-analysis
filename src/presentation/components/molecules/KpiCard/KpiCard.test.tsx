import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { KpiCard } from "./KpiCard"

describe("KpiCard", () => {
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
    expect(screen.getByText("Sube")).toBeInTheDocument()
    expect(screen.getByText("frente al periodo anterior")).toBeVisible()
  })
})
