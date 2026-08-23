import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INSIGHTS_FIXTURE } from "../../InsightsPage.test.helpers.ts";
import { InsightsPayees } from "./InsightsPayees.tsx";

describe("InsightsPayees", () => {
  it("renders expense, income and net ranks with coverage", () => {
    render(<InsightsPayees payees={INSIGHTS_FIXTURE.payees} />);

    expect(screen.getByText("Gasto clasificado")).toBeVisible();
    expect(screen.getByText("Ingreso clasificado")).toBeVisible();
    expect(screen.getByText("Neto absoluto")).toBeVisible();
    expect(screen.getByText("Tienda")).toBeVisible();
    expect(screen.getByText(/con payee/u)).toBeVisible();
  });
});
