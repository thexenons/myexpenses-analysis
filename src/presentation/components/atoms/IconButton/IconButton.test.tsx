import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Icon } from "../Icon"
import { IconButton } from "./IconButton"

describe("IconButton", () => {
  it("has an accessible name and activates from the keyboard", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn<() => void>()
    render(
      <IconButton
        icon={<Icon name="search" />}
        label="Buscar"
        onClick={onClick}
      />,
    )

    const button = screen.getByRole("button", { name: "Buscar" })
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onClick).toHaveBeenCalledOnce()
  })
})
