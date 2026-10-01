import { render, screen, within } from "@testing-library/react";
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
  directExpenseComposition: { grossExpensesEurMinor: 1_500, expenseRefundsEurMinor: 500, debtExpenseAdjustmentsEurMinor: 0, netExpenseConsumptionEurMinor: 1_000 },
  expenseComposition: { grossExpensesEurMinor: 1_500, expenseRefundsEurMinor: 500, debtExpenseAdjustmentsEurMinor: 0, netExpenseConsumptionEurMinor: 1_000 },
  id: '["Gastos","Comida"]',
  name: "Comida",
  path: ["Gastos", "Comida"],
  summary,
};

const root: CategoryBreakdownNode = {
  ...child,
  children: [child],
  directSummary: { ...summary, postingCount: 0 },
  directExpenseComposition: { grossExpensesEurMinor: 0, expenseRefundsEurMinor: 0, debtExpenseAdjustmentsEurMinor: 0, netExpenseConsumptionEurMinor: 0 },
  id: '["Gastos"]',
  name: "Gastos",
  path: ["Gastos"],
};

describe("CategoryTreeNode", () => {
  it("reveals expense composition independently of branch expansion and filter selection", async () => {
    const user = userEvent.setup();
    const onToggleCategory = vi.fn<(path: readonly string[]) => void>();
    const adjustedComposition = { grossExpensesEurMinor: 1_500, expenseRefundsEurMinor: 500, debtExpenseAdjustmentsEurMinor: 100, netExpenseConsumptionEurMinor: 900 };
    const adjustedChild = { ...child, expenseComposition: adjustedComposition, directExpenseComposition: adjustedComposition, summary: { ...summary, expensesEurMinor: -900, netEurMinor: -900 }, directSummary: { ...summary, expensesEurMinor: -900, netEurMinor: -900 } };
    render(
      <ul>
        <CategoryTreeNode
          category={{ ...root, children: [adjustedChild], expenseComposition: adjustedComposition, summary: { ...summary, expensesEurMinor: -900, netEurMinor: -900 } }}
          averageEurMinorByCategoryId={new Map()}
          averageUnit="month"
          averageScope="filtered"
          completedPeriodCount={0}
          depth={0}
          onToggleCategory={onToggleCategory}
          selectedCategoryIds={new Set()}
        />
      </ul>,
    );

    const [parentDisclosure, childDisclosure] = screen.getAllByText("Desglose del gasto");
    expect(parentDisclosure?.closest("details")).not.toHaveAttribute("open");
    expect(childDisclosure?.closest("details")).not.toHaveAttribute("open");
    await user.click(parentDisclosure!);
    expect(parentDisclosure?.closest("details")).toHaveAttribute("open");
    const panel = parentDisclosure!.closest("details")!;
    expect(within(panel).getByText("Gasto bruto")).toBeVisible();
    expect(within(panel).getByText("Devoluciones")).toBeVisible();
    expect(within(panel).getByText("Ajuste por deuda")).toBeVisible();
    expect(within(panel).getByText(/no es una devolución/i)).toBeVisible();
    expect(within(panel).getByText(/9,00/)).toBeVisible();
    expect(childDisclosure?.closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Contraer Gastos" }));
    expect(parentDisclosure?.closest("details")).toHaveAttribute("open");
    expect(screen.queryByRole("button", { name: "Filtrar: Gastos › Comida" })).toBeNull();
    expect(onToggleCategory).not.toHaveBeenCalled();
  });

  it("omits expense detail for income-only categories", () => {
    render(
      <ul><CategoryTreeNode
        category={{ ...child, categoryType: "INCOME", expenseComposition: { grossExpensesEurMinor: 0, expenseRefundsEurMinor: 0, debtExpenseAdjustmentsEurMinor: 0, netExpenseConsumptionEurMinor: 0 } }}
        averageEurMinorByCategoryId={new Map()}
        averageUnit="month"
        averageScope="filtered"
        completedPeriodCount={0}
        depth={0}
        onToggleCategory={vi.fn<(path: readonly string[]) => void>()}
        selectedCategoryIds={new Set()}
      /></ul>,
    );
    expect(screen.queryByText("Desglose del gasto")).toBeNull();
  });

  it("does not describe a debt-only negative net as an expense refund", async () => {
    const user = userEvent.setup();
    const debtComposition = {
      grossExpensesEurMinor: 0,
      expenseRefundsEurMinor: 0,
      debtExpenseAdjustmentsEurMinor: 100,
      netExpenseConsumptionEurMinor: -100,
    };
    render(
      <ul><CategoryTreeNode
        category={{
          ...child,
          summary: { ...summary, expensesEurMinor: 100, netEurMinor: 100 },
          directSummary: { ...summary, expensesEurMinor: 100, netEurMinor: 100 },
          expenseComposition: debtComposition,
          directExpenseComposition: debtComposition,
        }}
        averageEurMinorByCategoryId={new Map()}
        averageUnit="month"
        averageScope="filtered"
        completedPeriodCount={0}
        depth={0}
        onToggleCategory={vi.fn<(path: readonly string[]) => void>()}
        selectedCategoryIds={new Set()}
      /></ul>,
    );
    await user.click(screen.getByText("Desglose del gasto"));
    expect(screen.getByText(/El gasto neto conserva el signo de la perspectiva seleccionada/)).toBeVisible();
    expect(screen.queryByText(/un valor negativo indica devoluciones netas/)).toBeNull();
    expect(screen.getByText(/no es una devolución/)).toBeVisible();
  });

  it("expands branches and toggles an exact category selection", async () => {
    const user = userEvent.setup();
    const onToggleCategory = vi.fn<(path: readonly string[]) => void>();
    render(
      <ul>
        <CategoryTreeNode
          category={root}
          averageEurMinorByCategoryId={new Map([[root.id, -1_000], [child.id, -1_000]])}
          averageUnit="month"
          averageScope="filtered"
          completedPeriodCount={1}
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
    const collapse = screen.getByRole("button", { name: "Contraer Gastos" });
    const childrenId = collapse.getAttribute("aria-controls");
    expect(document.getElementById(childrenId!)).toBeInTheDocument();
    await user.click(collapse);
    expect(onToggleCategory).not.toHaveBeenCalled();
    expect(document.getElementById(childrenId!)).toHaveAttribute("hidden");
    await user.click(screen.getByRole("button", { name: "Desplegar Gastos" }));
    await user.click(screen.getByRole("button", { name: "Quitar filtro: Gastos › Comida" }));
    expect(onToggleCategory).toHaveBeenCalledWith(["Gastos", "Comida"]);
    expect(screen.getByRole("button", { name: "Contraer Gastos" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Contraer Gastos" }));
    expect(
      screen.queryByRole("button", { name: /Gastos › Comida/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Desplegar Gastos" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
