import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Badge } from "./Badge"

describe("Badge", () => {
  it("renders its semantic label without relying on color", () => {
    render(<Badge tone="debt">Cuenta de deuda</Badge>)

    expect(screen.getByText("Cuenta de deuda")).toBeVisible()
  })
})
