import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { aggregateKpis } from "../../../domain/analytics/aggregations.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import type { AppDataset, NormalizedPosting } from "../../../domain/analytics/types.ts";
import { createPerspectiveComparisonModel, createPerspectiveComparisonPageModel } from "./PerspectiveComparisonPage.helpers.ts";
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

  it.each([
    { name: "shared expense", entries: [["cash", -1000, "expense"], ["debt", 500, "expense"]], adjustment: -500 },
    { name: "shared refund", entries: [["cash", 200, "expense"], ["debt", -200, "expense"]], adjustment: 200 },
    { name: "direct card charge and refund", entries: [["debt", -1000, "expense"], ["debt", 100, "expense"]], adjustment: 900 },
    { name: "income mirror", entries: [["cash", 1000, "income"], ["debt", -1000, "income"]], adjustment: 1000 },
    { name: "direct debt income", entries: [["debt", 300, "income"]], adjustment: -300 },
    { name: "repayment", entries: [["cash", 300, "transfer"], ["debt", -300, "transfer"]], adjustment: 300 },
    { name: "debt to debt transfer", entries: [["debt", -200, "transfer"], ["card", 200, "transfer"]], adjustment: 0 },
    { name: "different EUR equivalents", entries: [["cash", -480, "expense"], ["debt", 500, "expense"]], adjustment: -500 },
    { name: "empty period", entries: [], adjustment: 0 },
  ] as const)("reconciles $name without mutating ledger or ordinary metrics", ({ entries, adjustment }) => {
    const fixture = {
      ...dataset,
      accounts: [...dataset.accounts, { ...dataset.accounts.find((account) => account.id === "debt")!, id: "card" }],
      postings: entries.map(([accountId, amount, bucket], index): NormalizedPosting => Object.assign({}, dataset.postings[0]!, {
        id: `entry-${index}`,
        accountId,
        accountType: accountId === "cash" ? "DEFAULT" as const : "DEBT" as const,
        amountNativeMinor: amount,
        amountEurMinor: amount,
        bucket,
        categoryType: bucket === "expense" ? "EXPENSE" as const : bucket === "income" ? "INCOME" as const : "TRANSFER" as const,
        categoryPath: [bucket, "Detail"],
      })),
    };
    const filters = createDefaultFilterState();
    const before = structuredClone(fixture);
    const scopes = ["all", "debtsOnly", "realCashFlow"] as const;
    const rawMetrics = scopes.map((scope) =>
      aggregateKpis(applyFilters(fixture, { ...filters, scope })),
    );
    const { rows, categories } = createPerspectiveComparisonPageModel(fixture, filters);
    expect(rows.find((row) => row.scope === "debtsOnly")?.netEurMinor).toBe(adjustment);
    const metrics = ["netEurMinor", "expensesEurMinor", "incomesEurMinor", "transfersEurMinor"] as const;
    for (const metric of metrics) {
      const yo = rows.find((row) => row.scope === "all")![metric];
      const debt = rows.find((row) => row.scope === "debtsOnly")![metric];
      const real = rows.find((row) => row.scope === "realCashFlow")![metric];
      expect(yo + debt).toBe(real);
      expect(Object.is(debt, -0)).toBe(false);
      expect(categories.reduce((sum, category) => sum + category.amounts.debtsOnly[metric], 0)).toBe(debt);
      for (const category of categories.flatMap((node) => [node].concat(node.children))) {
        expect(category.amounts.all[metric] + category.amounts.debtsOnly[metric]).toBe(category.amounts.realCashFlow[metric]);
      }
    }
    expect(fixture).toEqual(before);
    expect(scopes.map((scope) =>
      aggregateKpis(applyFilters(fixture, { ...filters, scope })),
    )).toEqual(rawMetrics);
  });

  it("reconciles signed incomes, expenses, transfers, and net with a derived debt adjustment", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(), scope: "debtsOnly",
    });
    expect(rows.map(({ scope }) => scope)).toEqual(["all", "debtsOnly", "realCashFlow"]);
    expect(rows.map(({ incomesEurMinor, expensesEurMinor, transfersEurMinor, netEurMinor }) =>
      [incomesEurMinor, expensesEurMinor, transfersEurMinor, netEurMinor],
    )).toEqual([
      [1000, -500, 0, 500],
      [0, 100, -300, -200],
      [1000, -400, -300, 300],
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
      [-300, 1], [0, 0], [-300, 1],
    ]);
  });

  it("applies search and status filters independently of the selected scope", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(), scope: "debtsOnly", search: "tienda", statuses: ["CLEARED"],
    });
    expect(rows.map(({ expensesEurMinor, netEurMinor }) => [expensesEurMinor, netEurMinor])).toEqual([
      [-600, -600], [0, 0], [-600, -600],
    ]);
  });

  it("renders an explicit empty period and a semantic signed comparison table", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(),
      dateRange: { from: "2027-01-01", to: "2027-01-31" },
    });
    render(<PerspectiveComparisonPageView categories={[]} rows={rows} searchPending={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Comparativa de perspectivas" })).toBeVisible();
    expect(screen.getByText(/No hay movimientos en el periodo/)).toBeVisible();
    const table = screen.getByRole("table", { name: /Comparación de movimientos/ });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Concepto", "Yo", "Ajuste por deudas", "Flujo real",
    ]);
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual([
      "Ingresos", "Gastos", "Transferencias", "Movimiento neto",
    ]);
  });

  it("keeps all three perspectives visible when the global scope is Yo", () => {
    const rows = createPerspectiveComparisonModel(dataset, {
      ...createDefaultFilterState(), scope: "all",
    });
    render(<PerspectiveComparisonPageView categories={[]} rows={rows} searchPending={false} />);
    expect(screen.queryByText(/No hay movimientos en el periodo/)).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Comparación de movimientos/ });
    const netRow = within(table).getByRole("row", { name: /Movimiento neto/ });
    expect(within(netRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "5,00 €", "-2,00 €", "3,00 €",
    ]);
    expect(screen.getByText(/no es un saldo ni necesariamente dinero gastado/)).toBeVisible();
  });

  it("leads with Yo and explains the related signed perspectives next to their values", async () => {
    const user = userEvent.setup();
    const rows = createPerspectiveComparisonModel(dataset, createDefaultFilterState());
    render(<PerspectiveComparisonPageView categories={[]} rows={rows} searchPending={false} />);
    const summary = screen.getByRole("region", { name: "Resumen de perspectivas" });
    const articles = within(summary).getAllByRole("article");
    expect(articles.map((article) => within(article).getByRole("heading").textContent)).toEqual([
      "Yo", "Ajuste por deudas", "Flujo real",
    ]);
    expect(articles.map((article) => article.querySelector("data")?.textContent)).toEqual([
      "5,00 €", "-2,00 €", "3,00 €",
    ]);
    expect(within(articles[0]!).getByText(/Yo \+ Ajuste por deudas = Flujo real/)).toBeVisible();
    expect(within(articles[1]!).getByText(/no es un saldo ni necesariamente dinero gastado/)).toBeVisible();
    expect(screen.getByText(/Son movimientos del mismo periodo, no saldos/)).toBeVisible();
    expect(screen.getByText(/Los hijos detallan el total del padre; no se suman de nuevo/)).toBeVisible();
    const information = screen.getByText("Información de la comparativa");
    expect(information.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("region", { name: "Categorías por perspectiva" }).compareDocumentPosition(information) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    await user.click(information);
    expect(information.closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/Los tipos de ingreso, gasto y transferencia no se reclasifican/)).toBeVisible();
    expect(articles.map((article) => within(article).getByText(/movimientos?$/).textContent)).toEqual([
      "Movimiento neto · 6 movimientos",
      "Ajuste contable · 2 movimientos",
      "Movimiento neto · 4 movimientos",
    ]);
  });

  it("gives the narrow comparison table a named keyboard-scroll region", () => {
    const rows = createPerspectiveComparisonModel(dataset, createDefaultFilterState());
    render(<PerspectiveComparisonPageView categories={[]} rows={rows} searchPending={false} />);
    const region = screen.getByRole("region", { name: "Comparación de movimientos por perspectiva" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("table", { name: "Comparación de movimientos por perspectiva" })).toBeVisible();
  });
});
