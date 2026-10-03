import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"

import { toggleCategoryPath } from "../../../../../../domain/analytics/filters.ts"
import { CategoryFilterTree } from "./index.ts"

it("selects roots and deep leaves independently of expansion and keeps explicit states", async () => {
  const user = userEvent.setup()
  function Example() {
    const [selected, setSelected] = useState<readonly (readonly string[])[]>([])
    return <CategoryFilterTree paths={[["Expense", "Food", "Groceries"], ["Income"], ["Expense"]]}
      selectedPaths={selected} onToggle={(path) => setSelected((current) => toggleCategoryPath(current, path))} />
  }
  render(<Example />)
  const root = screen.getByRole("button", { name: "Seleccionar Expense" })
  await user.click(root)
  expect(root).toHaveAttribute("aria-pressed", "true")
  expect(screen.queryByRole("button", { name: "Seleccionar Expense › Food" })).toBeNull()
  const disclosure = screen.getByRole("button", { name: "Desplegar Expense" })
  disclosure.focus()
  await user.keyboard("{Enter}")
  expect(root).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "Seleccionar Expense › Food" })).toHaveAttribute("aria-pressed", "false")
  await user.click(screen.getByRole("button", { name: "Desplegar Expense › Food" }))
  const leaf = screen.getByRole("button", { name: "Seleccionar Expense › Food › Groceries" })
  leaf.focus()
  await user.keyboard(" ")
  expect(leaf).toHaveAttribute("aria-pressed", "true")
  await user.click(screen.getByRole("button", { name: "Seleccionar Income" }))
  await user.click(screen.getByRole("button", { name: "Contraer Expense" }))
  await user.click(screen.getByRole("button", { name: "Desplegar Expense" }))
  await user.click(screen.getByRole("button", { name: "Desplegar Expense › Food" }))
  expect(screen.getByRole("button", { name: "Seleccionar Expense › Food › Groceries" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "Seleccionar Income" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.queryByRole("tree")).toBeNull()
  expect(screen.getAllByRole("list")).toHaveLength(3)
})

it("deduplicates paths and exposes uncategorized selection even without category data", () => {
  const { rerender } = render(<CategoryFilterTree paths={[]} selectedPaths={[[]]} onToggle={() => {}} />)
  expect(screen.getByRole("button", { name: "Seleccionar Sin categoría" })).toHaveAttribute("aria-pressed", "true")
  rerender(<CategoryFilterTree paths={[["A", "B"], ["A", "B"], ["A"]]} selectedPaths={[]} onToggle={() => {}} />)
  expect(screen.getAllByRole("button", { name: "Seleccionar A" })).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Seleccionar Sin categoría" })).toHaveAttribute("aria-pressed", "false")
})
