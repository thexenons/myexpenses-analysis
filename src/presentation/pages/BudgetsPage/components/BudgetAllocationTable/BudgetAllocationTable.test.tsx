import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("keeps current consumption, allocation and overrun visible with secondary values closed", async () => {
    const user = userEvent.setup();
    render(
      <BudgetAllocationTable
        allocations={[child]}
        currency="EUR"
        fractionDigits={2}
        onInspectConsumption={() => {}}
      />,
    );

    expect(screen.getByText("Comida")).toBeVisible();
    expect(screen.getByRole("button", { name: /Ver apuntes consumidos de Gastos › Comida: 35,00/ })).toBeVisible();
    expect(screen.getByText("30,00 €")).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización de Gastos › Comida" })).toBeVisible();
    const overrun = screen.getAllByText("Excedido").find((label) => label.closest("[hidden]") === null);
    expect(overrun).toBeVisible();

    const detailsToggle = screen.getByRole("button", { name: "Detalles de Gastos › Comida" });
    const details = document.getElementById(detailsToggle.getAttribute("aria-controls")!);
    expect(detailsToggle).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("hidden");
    await user.click(detailsToggle);
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
    expect(details).not.toHaveAttribute("hidden");
    expect(within(details!).getByText("Heredada")).toBeVisible();
    expect(within(details!).getByText("-5,00 €")).toBeVisible();
  });

  it("keeps category details separate from hierarchy expansion", async () => {
    const user = userEvent.setup();
    render(<BudgetAllocationTable allocations={[root]} currency="EUR" fractionDigits={2} />);

    const treeButton = screen.getByRole("button", { name: "Contraer Gastos" });
    const detailsToggle = screen.getByRole("button", { name: "Detalles de Gastos" });
    expect(detailsToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(detailsToggle);
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
    expect(treeButton).toHaveAttribute("aria-expanded", "true");
    await user.click(treeButton);
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Desplegar Gastos" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps null allocation and negative consumption explicit in the compact row", () => {
    render(
      <BudgetAllocationTable
        allocations={[{ ...child, assignedMinor: 0, consumedMinor: -500, availableMinor: 500, utilization: null, health: "unallocated" }]}
        currency="EUR"
        fractionDigits={2}
      />,
    );
    expect(screen.getByText("-5,00 €")).toBeVisible();
    const assigned = screen.getAllByText("0,00 €").find((amount) => amount.closest("[hidden]") === null);
    expect(assigned).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización de Gastos › Comida" })).toHaveAttribute("aria-valuetext", "Sin asignación");
  });

  it("includes the visible consumed amount in the category action name", () => {
    render(
      <BudgetAllocationTable
        allocations={[{ ...root, children: [] }]}
        currency="EUR"
        fractionDigits={2}
        onInspectConsumption={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Ver apuntes consumidos de Gastos.*45,00/ })).toBeVisible();
  });
  it("discloses nested allocations without making category names filter controls", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BudgetAllocationTable
        allocations={[root]}
        currency="EUR"
        fractionDigits={2}
      />,
    );

    const tree = screen.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
    expect(within(tree).getAllByRole("listitem")).toHaveLength(2);
    const disclosure = screen.getByRole("button", { name: "Contraer Gastos" });
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(disclosure).toHaveAttribute("aria-controls");
    expect(screen.getByText("Comida")).toBeVisible();
    expect(within(tree).queryByRole("button", { name: /Filtrar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Utilización de Gastos › Comida" })).toBeVisible();
    await user.click(screen.getByLabelText("Detalles de Gastos"));
    await user.click(screen.getByLabelText("Detalles de Gastos › Comida"));
    expect(screen.getByText("Periodo")).toBeVisible();
    expect(screen.getByText("En margen")).toBeVisible();
    expect(screen.getByText("Heredada")).toBeVisible();
    expect(screen.getAllByText("Excedido").some((label) => label.closest("[hidden]") === null)).toBe(true);
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    expect(await getAxeViolations(container)).toEqual([]);

    await user.click(disclosure);
    expect(screen.getByRole("button", { name: "Desplegar Gastos" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Comida")).not.toBeInTheDocument();
    expect(await getAxeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Desplegar Gastos" }));
    expect(screen.getByText("Comida")).toBeVisible();
  });

  it("keeps every financial measure and source badge at every depth", async () => {
    const user = userEvent.setup();
    const grandchild = {
      ...child,
      id: "grandchild",
      name: "Mercado",
      path: ["Gastos", "Comida", "Mercado"],
      depth: 2,
      allocationSource: "NONE" as const,
      oneTime: true,
      assignedMinor: 123,
      rolloverPreviousMinor: 25,
      rolloverNextMinor: -10,
      consumedMinor: 50,
      availableMinor: 73,
      utilization: 50 / 123,
      health: "watch" as const,
    };
    render(
      <BudgetAllocationTable
        allocations={[{
          ...root,
          allocationSource: "ROLLUP",
          children: [
            { ...child, children: [grandchild] },
            { ...child, id: "unallocated", name: "Otros", path: ["Gastos", "Otros"], allocationSource: "NONE", health: "unallocated" },
          ],
        }]}
        currency="EUR"
        fractionDigits={2}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Desplegar Gastos › Comida" }));
    await user.click(screen.getByLabelText("Detalles de Gastos"));
    await user.click(screen.getByLabelText("Detalles de Gastos › Comida"));
    await user.click(screen.getByLabelText("Detalles de Gastos › Comida › Mercado"));
    await user.click(screen.getByLabelText("Detalles de Gastos › Otros"));

    expect(screen.getByText("Roll-up")).toBeVisible();
    expect(screen.getByText("Heredada")).toBeVisible();
    expect(screen.getAllByText("Sin base")).toHaveLength(2);
    expect(screen.getByText("Única")).toBeVisible();
    expect(screen.getByText("Vigilancia")).toBeVisible();
    expect(screen.getByText("Sin asignar")).toBeVisible();
    expect(screen.getByText("Mercado")).toBeVisible();
    for (const label of ["Origen", "Asignado", "Arrastre", "Consumido", "Disponible", "Utilización", "Estado"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("1,23 €")).toBeVisible();
    expect(screen.getByText("0,25 €")).toBeVisible();
    expect(screen.getByText("sig. -0,10 €")).toBeVisible();
    expect(screen.getByText("0,50 €")).toBeVisible();
    expect(screen.getByText("0,73 €")).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización de Gastos › Comida › Mercado" })).toBeVisible();
  });

  it("uses neutral cutoff labels and preserves precision", async () => {
    const user = userEvent.setup();
    render(
      <BudgetAllocationTable
        allocations={[{ ...root, assignedMinor: 1001, availableMinor: 1001, health: "on-track", children: [] }]}
        currency="KWD"
        fractionDigits={3}
        isFilteredComparison
      />,
    );
    await user.click(screen.getByLabelText("Detalles de Gastos"));
    expect(screen.getByText("Asignado menos corte")).toBeVisible();
    expect(screen.getByText("Corte filtrado")).toBeVisible();
    expect(screen.queryByText("Disponible")).not.toBeInTheDocument();
    expect(screen.queryByText("En margen")).not.toBeInTheDocument();
    expect(screen.getByText("Utilización del corte")).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización del corte de Gastos" })).toBeVisible();
    expect(screen.getAllByText(/1,001/)).toHaveLength(2);
  });

  it("retains the empty state", () => {
    render(<BudgetAllocationTable allocations={[]} currency="EUR" fractionDigits={2} />);
    expect(screen.getByText("Este periodo no tiene asignaciones por categoría.")).toBeVisible();
  });
});
