import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BudgetControls } from "./BudgetControls.tsx";

describe("BudgetControls", () => {
  it("exposes labelled selectors and reports both choices", async () => {
    const user = userEvent.setup();
    const onBudgetChange = vi.fn<(uuid: string) => void>();
    const onPeriodChange = vi.fn<(key: string) => void>();
    render(
      <BudgetControls
        budgets={[
          { value: "one", label: "Principal" },
          { value: "two", label: "Alternativo" },
        ]}
        onBudgetChange={onBudgetChange}
        onPeriodChange={onPeriodChange}
        periods={[
          { value: "august", label: "Agosto" },
          { value: "july", label: "Julio" },
        ]}
        selectedBudgetUuid="one"
        selectedPeriodKey="august"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Presupuesto"), "two");
    await user.selectOptions(screen.getByLabelText("Periodo"), "july");

    expect(onBudgetChange).toHaveBeenCalledWith("two");
    expect(onPeriodChange).toHaveBeenCalledWith("july");
  });

  it("states that no safe period exists instead of creating one", () => {
    render(
      <BudgetControls
        budgets={[{ value: "one", label: "Principal" }]}
        onBudgetChange={vi.fn<(uuid: string) => void>()}
        onPeriodChange={vi.fn<(key: string) => void>()}
        periods={[]}
        selectedBudgetUuid="one"
        selectedPeriodKey=""
      />,
    );

    expect(screen.getByLabelText("Periodo")).toBeDisabled();
    expect(screen.getByRole("option", { name: "Sin periodo seguro" })).toBeVisible();
  });
});
