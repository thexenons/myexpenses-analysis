import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Icon } from "./Icon"

describe("Icon", () => {
  it("hides decorative icons from assistive technologies", () => {
    const { container } = render(<Icon name="wallet" />)

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("exposes an accessible image when a label is supplied", () => {
    render(<Icon label="Cuenta bancaria" name="bank" />)

    expect(screen.getByRole("img", { name: "Cuenta bancaria" })).toBeVisible()
  })
})
