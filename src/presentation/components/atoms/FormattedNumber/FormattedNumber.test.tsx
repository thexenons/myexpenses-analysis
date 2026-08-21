import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FormattedNumber } from "./FormattedNumber"

describe("FormattedNumber", () => {
  it("preserves the machine value and uses the supplied formatter", () => {
    render(
      <FormattedNumber
        formatter={(value) => `${value.toFixed(2)} €`}
        value={1234.5}
      />,
    )

    const number = screen.getByText("1234.50 €")
    expect(number).toHaveAttribute("value", "1234.5")
  })
})
