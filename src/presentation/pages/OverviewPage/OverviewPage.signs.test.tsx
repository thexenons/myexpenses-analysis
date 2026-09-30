import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import type { ParsedDirectTransaction } from "../../../domain/analytics/types.ts";
import { formatEuroMinor } from "../../utils/format.ts";
import { createOverviewPageModel } from "./OverviewPage.helpers.ts";
import { OverviewPageView } from "./OverviewPage.view.tsx";

describe("Overview expense orientation", () => {
  it.each([
    { name: "shared expense mirror", amount: 5, peerAmount: -5, income: false },
    { name: "shared refund mirror", amount: -2, peerAmount: 2, income: false },
    { name: "direct card charge", amount: -10, peerAmount: null, income: false },
    { name: "direct card refund", amount: 1, peerAmount: null, income: false },
    { name: "income mirror", amount: -7, peerAmount: 7, income: true },
  ])("explains $name without changing signed amounts", async ({ amount, peerAmount, income }) => {
    const transaction = (value: number): ParsedDirectTransaction => ({
      uuid: "movement", sourceTransactionUuid: "movement", date: "2026-01-15",
      amount: value, category: ["Category"], sourceStatus: "RECONCILED",
      splitIndex: null, splitCount: null,
    });
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: {
        cash: { label: "Cash", type: "DEFAULT" },
        debt: { label: "Debt", type: "DEBT" },
      } },
      categories: { Category: { categoryType: income ? "INCOME" : "EXPENSE" } },
      parsedData: [
        { uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0,
          transactions: peerAmount === null ? [] : [transaction(peerAmount)] },
        { uuid: "debt", label: "Debt", currency: "EUR", openingBalance: 0,
          transactions: [transaction(amount)] },
      ],
    });
    const source = {
      ...initial,
      postings: initial.postings.map((row) => peerAmount === null ? row : Object.assign({}, row, {
        linked: true,
        transferPeerPostingId: initial.postings.find((peer) => peer.accountId !== row.accountId)!.id,
      })),
    };
    const original = structuredClone(source);
    const filtered = applyFilters(source, { ...createDefaultFilterState(), scope: "debtsOnly" });
    const model = createOverviewPageModel(filtered, "month", false);
    const signedExpense = income ? 0 : amount * 100;
    expect(model.kpis.expensesEurMinor).toBe(signedExpense);
    expect(model.kpis.incomesEurMinor).toBe(income ? amount * 100 : 0);
    expect(model.kpis.netEurMinor).toBe(amount * 100);
    expect(source).toEqual(original);

    render(<OverviewPageView {...model} />);
    const expenseCard = screen.getByRole("article", { name: "Gastos netos" });
    expect(within(expenseCard).getByText(formatEuroMinor(-signedExpense), { normalizer: (text) => text })).toBeVisible();
    expect(screen.getByText("Composición y categorías").closest("details")).not.toHaveAttribute("open");
    const expectedRefund = !income && peerAmount === null && amount > 0 ? amount * 100 : 0;
    expect(model.kpis.expenseRefundsEurMinor).toBe(expectedRefund);
    const card = screen.getByRole("article", { name: income ? "Ingresos netos" : "Gastos netos" });
    const baseDetail = income ? `${formatEuroMinor(0)} bruto` : `${formatEuroMinor(expectedRefund)} devuelto`;
    const allocation = income ? model.kpis.debtIncomeAdjustmentsEurMinor ?? 0 : model.kpis.debtExpenseAdjustmentsEurMinor ?? 0;
    const expectedDetail = allocation === 0 ? baseDetail : `${baseDetail} · Asignación en deudas: ${formatEuroMinor(allocation)}; no es ${income ? "reversión de ingreso" : "devolución"}.`;
    expect(within(card).getByText(expectedDetail, { normalizer: (text) => text })).toBeVisible();
    const information = screen.getByText("Información del resumen");
    expect(information.closest("details")).not.toHaveAttribute("open");
    await userEvent.setup().click(information);
    expect(information.closest("details")!.textContent?.replaceAll("\u00a0", " "))
      .toContain(formatEuroMinor(peerAmount === null ? 0 : amount * 100).replaceAll("\u00a0", " "));
    expect(information.closest("details")).toHaveTextContent(income ? "no es una reversión de ingreso" : "no son dinero devuelto");
    expect(model.chartSeries.find(({ id }) => id === "expenses")).toMatchObject({
      label: "Movimiento contable de gastos",
      data: [{ value: signedExpense / 100 }],
    });
    expect(screen.getByRole("button", { name: /Movimiento contable de gastos/ })).toBeVisible();
  });
});
