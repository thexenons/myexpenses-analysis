import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BudgetUtilization } from "./BudgetUtilization.tsx";

describe("BudgetUtilization", () => {
  it("keeps the accessible meter bounded while exposing an overrun", () => {
    render(
      <BudgetUtilization
        health="exceeded"
        label="Utilización de vivienda"
        utilization={1.25}
      />,
    );

    const meter = screen.getByRole("meter", { name: "Utilización de vivienda" });
    expect(meter).toHaveAttribute("aria-valuenow", "100");
    expect(meter).toHaveAttribute("aria-valuetext", "125 %");
  });

  it("announces a missing allocation without dividing by zero", () => {
    render(
      <BudgetUtilization
        health="unallocated"
        label="Utilización global"
        utilization={null}
      />,
    );

    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "Sin asignación",
    );
  });
});
