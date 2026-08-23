import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { getAxeViolations } from "../../../../../tests/setup/axe.ts"
import { DataTable } from "./DataTable"
import type { DataTableColumn } from "./DataTable.types"

interface Row {
  id: string
  amount: number
  name: string
}

describe("DataTable", () => {
  it("renders row headers and activates sortable column controls", async () => {
    const user = userEvent.setup()
    const onSort = vi.fn<() => void>()
    const columns: DataTableColumn<Row>[] = [
      { key: "name", header: "Cuenta", cell: (row) => row.name, rowHeader: true },
      {
        align: "end",
        cell: (row) => row.amount,
        header: "Saldo",
        key: "amount",
        onSort,
        sortDirection: "ascending",
      },
    ]
    render(
      <DataTable
        caption="Saldos por cuenta"
        columns={columns}
        rowKey={(row) => row.id}
        rows={[{ amount: 250, id: "cash", name: "Efectivo" }]}
      />,
    )

    expect(screen.getByRole("table", { name: "Saldos por cuenta" })).toBeVisible()
    expect(
      screen.getByRole("region", { name: "Saldos por cuenta" }),
    ).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("rowheader", { name: "Efectivo" })).toBeVisible()
    const sortButton = screen.getByRole("button", { name: "Saldo" })
    await user.click(sortButton)
    expect(onSort).toHaveBeenCalledOnce()
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "ascending")
  })

  it("renders the supplied empty state", () => {
    render(
      <DataTable<Row>
        columns={[]}
        empty="Sin movimientos"
        rowKey={(row) => row.id}
        rows={[]}
      />,
    )

    expect(screen.getByText("Sin movimientos")).toBeVisible()
  })

  it("has no detectable WCAG violations with sortable columns", async () => {
    const columns: DataTableColumn<Row>[] = [
      { key: "name", header: "Cuenta", cell: (row) => row.name, rowHeader: true },
      {
        cell: (row) => row.amount,
        header: "Saldo",
        key: "amount",
        onSort: vi.fn<() => void>(),
        sortDirection: "none",
      },
    ]
    const { container } = render(
      <DataTable
        caption="Saldos por cuenta"
        columns={columns}
        rowKey={(row) => row.id}
        rows={[{ amount: 250, id: "cash", name: "Efectivo" }]}
      />,
    )

    expect(await getAxeViolations(container)).toEqual([])
  })
})
