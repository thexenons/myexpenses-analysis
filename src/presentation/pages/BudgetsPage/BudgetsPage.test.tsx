import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  BudgetAllocationNode,
  BudgetAnalysis,
} from "../../../domain/analytics/budgets.ts";
import type { BackupBudgetV1 } from "../../../domain/analytics/backup-dataset.types.ts";
import { BudgetsPageView } from "./BudgetsPage.view.tsx";

const budget: BackupBudgetV1 = {
  uuid: "budget",
  sourceId: 1,
  title: "Presupuesto doméstico",
  description: "",
  grouping: "MONTH",
  accountUuid: null,
  currency: "EUR",
  startDate: null,
  endDate: null,
  isDefault: true,
  filter: {
    type: "and",
    criteria: [
      {
        type: "account",
        accountUuids: ["a", "b", "c", "d", "e", "f", "g"],
      },
      { type: "category", categoryUuids: ["one", "two"] },
    ],
  },
  aggregateNeutral: false,
  allocations: [],
};

const allocation: BudgetAllocationNode = {
  id: "food",
  categoryUuid: "food",
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

const analysis: BudgetAnalysis = {
  budget,
  period: {
    key: "MONTH:2026:7",
    grouping: "MONTH",
    year: 2026,
    second: 7,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    label: "Agosto de 2026",
  },
  periods: [
    {
      key: "MONTH:2026:7",
      grouping: "MONTH",
      year: 2026,
      second: 7,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      label: "Agosto de 2026",
    },
    {
      key: "MONTH:2026:6",
      grouping: "MONTH",
      year: 2026,
      second: 6,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      label: "Julio de 2026",
    },
  ],
  currency: "EUR",
  fractionDigits: 2,
  global: {
    baseMinor: 10_000,
    rolloverPreviousMinor: 1_000,
    rolloverNextMinor: 0,
    assignedMinor: 11_000,
    consumedMinor: 6_500,
    availableMinor: 4_500,
    utilization: 6_500 / 11_000,
    health: "on-track",
  },
  allocations: [allocation],
  categoryAssignedMinor: 9_000,
  categorizedConsumedMinor: 4_500,
  unallocatedConsumedMinor: 2_000,
  filteredPostingCount: 4,
  ownFilterApplied: true,
  aggregateNeutral: false,
  filterSummary: {
    rootOperator: "AND",
    accountCount: 7,
    categoryCount: 2,
  },
};

describe("BudgetsPageView", () => {
  it("renders budget KPIs, the technical global allocation and hierarchy", async () => {
    const user = userEvent.setup();
    const onBudgetChange = vi.fn<(uuid: string) => void>();
    const onPeriodChange = vi.fn<(key: string) => void>();
    render(
      <BudgetsPageView
        analysis={analysis}
        budgetOptions={[
          { value: "budget", label: "Presupuesto doméstico" },
          { value: "second", label: "Segundo presupuesto" },
        ]}
        emptyDescription={null}
        emptyTitle={null}
        onBudgetChange={onBudgetChange}
        onPeriodChange={onPeriodChange}
        periodOptions={analysis.periods.map((period) => ({
          value: period.key,
          label: period.label,
        }))}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey="MONTH:2026:7"
      />,
    );

    expect(screen.getByRole("heading", { name: "Presupuestos" })).toBeVisible();
    expect(screen.getByText("Asignado global")).toBeVisible();
    expect(screen.getByText("Gasto neto")).toBeVisible();
    expect(screen.getByRole("rowheader", { name: /Comida/ })).toBeVisible();
    expect(screen.getByText("Heredada")).toBeVisible();
    expect(screen.getByText("Excedido")).toBeVisible();
    expect(screen.getByText("AND · 7 cuentas · 2 categorías")).toBeVisible();
    expect(screen.getAllByRole("meter").length).toBeGreaterThan(1);
    expect(
      screen.getByText(/fila técnica sin categoría/i),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Presupuesto"), "second");
    expect(onBudgetChange).toHaveBeenCalledWith("second");
    await user.selectOptions(screen.getByLabelText("Periodo"), "MONTH:2026:6");
    expect(onPeriodChange).toHaveBeenCalledWith("MONTH:2026:6");
  });

  it("exposes unsupported semantics instead of silently fabricating a result", () => {
    render(
      <BudgetsPageView
        analysis={null}
        budgetOptions={[{ value: "budget", label: "Presupuesto doméstico" }]}
        emptyDescription="No hay periodos configurados que puedan representarse sin inferencias."
        emptyTitle="Presupuesto no representable con seguridad"
        onBudgetChange={vi.fn<(uuid: string) => void>()}
        onPeriodChange={vi.fn<(key: string) => void>()}
        periodOptions={[]}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey=""
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Presupuesto no representable con seguridad",
      }),
    ).toBeVisible();
    expect(screen.getByText(/sin inferencias/i)).toBeVisible();
    expect(screen.getByLabelText("Periodo")).toBeDisabled();
  });
});
