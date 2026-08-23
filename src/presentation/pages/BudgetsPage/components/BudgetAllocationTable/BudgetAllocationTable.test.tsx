import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";
import { getAxeViolations } from "../../../../../../tests/setup/axe.ts";
import { BudgetAllocationTable } from "./BudgetAllocationTable.tsx";

const child: BudgetAllocationNode = {
  id: "child",
  categoryUuid: "child",
  name: "Comida",
  path: ["Gastos", "Comida"],
  categoryType: "EXPENSE",
  depth: 1,
  hasDirectAllocation: true,
  allocationSource: "FALLBACK",
  oneTime: false,
  childAssignedMinor: 0,
  directConsumedMinor: 3_500,
  postingCount: 2,
  children: [],
  baseMinor: 3_000,
  rolloverPreviousMinor: 0,
  rolloverNextMinor: 0,
  assignedMinor: 3_000,
  consumedMinor: 3_500,
  availableMinor: -500,
  utilization: 3_500 / 3_000,
  health: "exceeded",
};

const root: BudgetAllocationNode = {
  ...child,
  id: "root",
  categoryUuid: "root",
  name: "Gastos",
  path: ["Gastos"],
  depth: 0,
  allocationSource: "EXACT",
  childAssignedMinor: 3_000,
  directConsumedMinor: 1_000,
  postingCount: 3,
  children: [child],
  baseMinor: 9_000,
  assignedMinor: 9_000,
  consumedMinor: 4_500,
  availableMinor: 4_500,
  utilization: 0.5,
  health: "on-track",
};

describe("BudgetAllocationTable", () => {
  it("flattens the hierarchy once and exposes fallback and overrun states", async () => {
    const { container } = render(
      <BudgetAllocationTable
        allocations={[root]}
        currency="EUR"
        fractionDigits={2}
      />,
    );

    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders).toHaveLength(2);
    expect(rowHeaders[0]).toHaveTextContent("Gastos");
    expect(rowHeaders[1]).toHaveTextContent("Comida");
    expect(screen.getByText("Heredada")).toBeVisible();
    expect(screen.getByText("Excedido")).toBeVisible();
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    expect(await getAxeViolations(container)).toEqual([]);
  });
});
