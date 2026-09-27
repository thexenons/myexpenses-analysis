import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import type { AppDataset } from "../../../domain/analytics/types.ts";
import { createPerspectiveComparisonModel } from "./PerspectiveComparisonPage.helpers.ts";
import { PerspectiveComparisonPageView } from "./PerspectiveComparisonPage.view.tsx";

const source: AppDataset = {
  accounts: { version: 2, accounts: {
    cash: { label: "Efectivo", type: "DEFAULT" },
    debt: { label: "Deuda", type: "DEBT" },
  } },
  categories: {
    Ingresos: { categoryType: "INCOME" },
    Gastos: { categoryType: "EXPENSE" },
    Transferencia: { categoryType: "TRANSFER" },
  },
  parsedData: [
    { uuid: "cash", label: "Efectivo", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "income", date: "2026-01-02", amount: 10, category: ["Ingresos"], sourceTransactionUuid: "income", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "expense", date: "2026-01-03", amount: -6, category: ["Gastos"], payee: "Tienda", sourceTransactionUuid: "expense", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "refund", date: "2026-01-04", amount: 2, category: ["Gastos"], sourceTransactionUuid: "refund", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "transfer-cash", date: "2026-01-05", amount: -3, category: ["Transferencia"], sourceTransactionUuid: "transfer-cash", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "void", date: "2026-01-06", amount: -99, category: ["Gastos"], sourceTransactionUuid: "void", sourceStatus: "VOID", splitIndex: null, splitCount: null },
    ] },
    { uuid: "debt", label: "Deuda", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "transfer-debt", date: "2026-01-05", amount: 3, category: ["Transferencia"], sourceTransactionUuid: "transfer-debt", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "debt-expense", date: "2026-01-07", amount: -1, category: ["Gastos"], sourceTransactionUuid: "debt-expense", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    ] },
  ],
};

describe("perspective comparison", () => {
  const dataset = normalizeDataset(source);

  it("compares signed incomes, expenses, transfers, and net across all three scopes", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(), scope: "debtsOnly",
    });
    expect(rows.map(({ scope }) => scope)).toEqual(["realCashFlow", "all", "debtsOnly"]);
    expect(rows.map(({ incomesEurMinor, expensesEurMinor, transfersEurMinor, netEurMinor }) =>
      [incomesEurMinor, expensesEurMinor, transfersEurMinor, netEurMinor],
    )).toEqual([
      [1000, -400, -300, 300],
      [1000, -500, 0, 500],
      [0, -100, 300, 200],
    ]);
  });

  it("intersects account, date, and content filters without expanding selection", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(),
      accountIds: ["cash"],
      dateRange: { from: "2026-01-04", to: "2026-01-05" },
      categoryPrefixes: [["Transferencia"]],
      scope: "all",
    });
    expect(rows.map(({ netEurMinor, postingCount }) => [netEurMinor, postingCount])).toEqual([
      [-300, 1], [-300, 1], [0, 0],
    ]);
  });

  it("applies search and status filters independently of the selected scope", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(), scope: "debtsOnly", search: "tienda", statuses: ["CLEARED"],
    });
    expect(rows.map(({ expensesEurMinor, netEurMinor }) => [expensesEurMinor, netEurMinor])).toEqual([
      [-600, -600], [-600, -600], [0, 0],
    ]);
  });

  it("renders an explicit empty period and a semantic signed comparison table", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(),
      dateRange: { from: "2027-01-01", to: "2027-01-31" },
    });
    render(<PerspectiveComparisonPageView rows={rows} searchPending={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Comparativa de perspectivas" })).toBeVisible();
    expect(screen.getByText(/No hay movimientos en el periodo/)).toBeVisible();
    const table = screen.getByRole("table", { name: /Comparación de movimientos/ });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Concepto", "Flujo real", "Yo", "Deudas",
    ]);
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual([
      "Ingresos", "Gastos", "Transferencias", "Movimiento neto",
    ]);
  });

  it("keeps all three perspectives visible when the global scope is Yo", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(), scope: "all",
    });
    render(<PerspectiveComparisonPageView rows={rows} searchPending={false} />);
    expect(screen.queryByText(/No hay movimientos en el periodo/)).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Comparación de movimientos/ });
    const netRow = within(table).getByRole("row", { name: /Movimiento neto/ });
    expect(within(netRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "3,00 €", "5,00 €", "2,00 €",
    ]);
    expect(screen.getByText(/no es gasto atribuido ni saldo/)).toBeVisible();
  });
});
