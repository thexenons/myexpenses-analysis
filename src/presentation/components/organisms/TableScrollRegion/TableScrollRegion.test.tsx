import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TableScrollRegion } from "./TableScrollRegion"

describe("TableScrollRegion", () => {
  it("keeps a named table region keyboard-focusable and composes a caller class", () => {
    render(
      <TableScrollRegion className="comparison-scroll" label="Comparison table">
        <table><tbody><tr><td>Amount</td></tr></tbody></table>
      </TableScrollRegion>,
    )

    const region = screen.getByRole("region", { name: "Comparison table" })
    expect(region).toHaveAttribute("tabindex", "0")
    expect(region).toHaveClass("comparison-scroll")
    expect(region).toContainElement(screen.getByRole("table"))
  })
})
