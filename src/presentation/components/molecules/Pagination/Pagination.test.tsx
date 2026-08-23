import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Pagination } from "./Pagination"

describe("Pagination", () => {
  it("announces the current page and requests keyboard navigation", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn<(page: number) => void>()
    render(
      <Pagination
        onPageChange={onPageChange}
        page={3}
        pageCount={8}
      />,
    )

    expect(screen.getByRole("button", { name: "Página 3, actual" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    const next = screen.getByRole("button", { name: "Página siguiente" })
    next.focus()
    await user.keyboard("{Enter}")
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it("does not render controls for a single page", () => {
    const { container } = render(
      <Pagination onPageChange={vi.fn<(page: number) => void>()} page={1} pageCount={1} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
