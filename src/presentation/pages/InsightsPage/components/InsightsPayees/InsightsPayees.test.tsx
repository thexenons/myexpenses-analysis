import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { INSIGHTS_FIXTURE } from "../../InsightsPage.test.helpers.ts";
import { InsightsPayees } from "./InsightsPayees.tsx";

describe("InsightsPayees", () => {
  it("shows all retained counterparties and preserves a net refund's sign", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 30 }, (_, index) => ({ name: `Comercio ${index + 1}`, sourceId: index + 1, postingCount: 1, expenseEurMinor: index === 0 ? 100 : -100, incomeEurMinor: 0, netEurMinor: index === 0 ? 100 : -100 }));
    render(<InsightsPayees payees={{ ...INSIGHTS_FIXTURE.payees, topExpenses: rows, topIncome: [], topNet: [] }} />);
    expect(screen.queryByText("Comercio 30")).not.toBeInTheDocument();
    expect(screen.getByText("Comercio 1").closest("li")).toHaveTextContent("-1,00");
    await user.selectOptions(screen.getByLabelText("Contrapartes por ranking"), "all");
    expect(screen.getByText("Comercio 30")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Contrapartes por ranking"), "5");
    await user.click(screen.getByText("Ver datos exactos"));
    expect(await screen.findByRole("rowheader", { name: "Comercio 30" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar CSV: Importes completos por contraparte" })).toBeVisible();
  });

  it("renders expense, income and net ranks with coverage", () => {
    render(<InsightsPayees payees={INSIGHTS_FIXTURE.payees} />);

    expect(screen.getByText("Gasto clasificado")).toBeVisible();
    expect(screen.getByText("Ingreso clasificado")).toBeVisible();
    expect(screen.getByText("Neto absoluto")).toBeVisible();
    expect(screen.getByText("Tienda")).toBeVisible();
    expect(screen.getByText(/con payee/u)).toBeVisible();
  });
});
