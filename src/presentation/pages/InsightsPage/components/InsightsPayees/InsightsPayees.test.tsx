import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { INSIGHTS_FIXTURE } from "../../InsightsPage.test.helpers.ts";
import { InsightsPayees } from "./InsightsPayees.tsx";

describe("InsightsPayees", () => {
  it("shows all retained counterparties and preserves a net refund's sign", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 30 }, (_, index) => ({ identityKey: `["source",${index + 1}]`, name: `Comercio ${index + 1}`, sourceId: index + 1, postingCount: 1, expenseEurMinor: index === 0 ? 100 : -100, incomeEurMinor: 0, netEurMinor: index === 0 ? 100 : -100 }));
    render(<InsightsPayees payees={{ ...INSIGHTS_FIXTURE.payees, topExpenses: rows, topIncome: [], topNet: [] }} />);
    expect(screen.queryByText("Comercio 30")).not.toBeInTheDocument();
    expect(screen.getByText("Comercio 1").closest("li")).toHaveTextContent("-1,00");
    expect(screen.getByText(
      "El gasto negativo puede deberse a devoluciones o a asignaciones en deudas; los ingresos y el neto conservan su signo.",
      { exact: false },
    )).toBeVisible();
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

  it("uses singular coverage wording for one active posting and one payee", () => {
    render(<InsightsPayees payees={{ ...INSIGHTS_FIXTURE.payees, activePostingCount: 1, payeePostingCount: 1, usedPayeeCount: 1, definedPayeeCount: 1 }} />);
    expect(screen.getByText(/1 apunte activo · 1 payee usado de 1 definido/u)).toBeVisible();
  });

  it("exposes distinct exact-identity actions for duplicate labels and disables pending actions", async () => {
    const onViewPayee = vi.fn<(identityKey: string) => void>();
    const first = INSIGHTS_FIXTURE.payees.topExpenses[0]!;
    const second = { ...first, identityKey: '["source",2]', sourceId: 2, expenseEurMinor: -200, netEurMinor: -200, postingCount: 1 };
    const payees = { ...INSIGHTS_FIXTURE.payees, topExpenses: [first, second], topIncome: [], topNet: [] };
    const user = userEvent.setup();
    const { rerender } = render(<InsightsPayees onViewPayee={onViewPayee} payees={payees} searchPending />);
    const firstAction = screen.getByRole("button", { name: "Ver 2 movimientos computados de Tienda (ID 1)" });
    expect(firstAction).toBeDisabled();
    rerender(<InsightsPayees onViewPayee={onViewPayee} payees={payees} />);
    await user.click(firstAction);
    await user.click(screen.getByRole("button", { name: "Ver 1 movimiento computado de Tienda (ID 2)" }));
    expect(onViewPayee.mock.calls).toEqual([[first.identityKey], [second.identityKey]]);
  });
});
