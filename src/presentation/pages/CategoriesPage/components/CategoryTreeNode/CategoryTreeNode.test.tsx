import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AmountSummary,
  CategoryBreakdownNode,
} from "../../../../../domain/analytics/types.ts";
import { CategoryTreeNode } from "./CategoryTreeNode.tsx";

const summary: AmountSummary = {
  debtFlowEurMinor: 0,
  expensesEurMinor: -1_000,
  incomesEurMinor: 0,
  netEurMinor: -1_000,
  postingCount: 1,
  realCashFlowEurMinor: -1_000,
  transfersEurMinor: 0,
};

const child: CategoryBreakdownNode = {
  categoryType: "EXPENSE",
  children: [],
  directSummary: summary,
  id: '["Gastos","Comida"]',
  name: "Comida",
  path: ["Gastos", "Comida"],
  summary,
};

const root: CategoryBreakdownNode = {
  ...child,
  children: [child],
  directSummary: { ...summary, postingCount: 0 },
  id: '["Gastos"]',
  name: "Gastos",
  path: ["Gastos"],
};

describe("CategoryTreeNode", () => {
  it("expands branches and toggles an exact category selection", async () => {
    const user = userEvent.setup();
    const onToggleCategory = vi.fn<(path: readonly string[]) => void>();
    render(
      <ul>
        <CategoryTreeNode
          category={root}
          depth={1}
          onToggleCategory={onToggleCategory}
          selectedCategoryIds={new Set([child.id])}
        />
      </ul>,
    );

    const childSelection = screen.getByRole("button", {
      name: "Quitar filtro: Gastos › Comida",
    });
    expect(childSelection).toHaveAttribute("aria-pressed", "true");
    await user.click(childSelection);
    expect(onToggleCategory).toHaveBeenCalledWith(["Gastos", "Comida"]);

    await user.click(screen.getByRole("button", { name: "Contraer Gastos" }));
    expect(
      screen.queryByRole("button", { name: /Gastos › Comida/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Desplegar Gastos" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
