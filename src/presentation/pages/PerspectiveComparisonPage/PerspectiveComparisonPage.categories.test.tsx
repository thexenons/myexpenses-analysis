import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import type { AnalyticsDataset, AppDataset, FilterState } from "../../../domain/analytics/types.ts";
import { createPerspectiveComparisonPageModel } from "./PerspectiveComparisonPage.helpers.ts";
import { PerspectiveComparisonPageView } from "./PerspectiveComparisonPage.view.tsx";

const source: AppDataset = {
  accounts: { version: 2, accounts: {
    cash: { label: "Efectivo", type: "DEFAULT" },
    debt: { label: "Deuda", type: "DEBT" },
  } },
  categories: {
    Gastos: { categoryType: "EXPENSE", children: {
      Comida: { categoryType: "EXPENSE", children: {
        Supermercado: { categoryType: "EXPENSE" },
      } },
    } },
    Otro: { categoryType: "EXPENSE", children: {
      Supermercado: { categoryType: "EXPENSE" },
    } },
    SoloDeuda: { categoryType: "EXPENSE" },
    "Sin categoría": { categoryType: "EXPENSE" },
    Ingresos: { categoryType: "INCOME" },
    Transferencia: { categoryType: "TRANSFER" },
  },
  parsedData: [
    { uuid: "cash", label: "Efectivo", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "parent", date: "2026-01-01", amount: -10, category: ["Gastos"], sourceTransactionUuid: "parent", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "child", date: "2026-01-02", amount: -5, category: ["Gastos", "Comida", "Supermercado"], payee: "Mercado", sourceTransactionUuid: "child", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "refund", date: "2026-01-03", amount: 2, category: ["Gastos", "Comida", "Supermercado"], sourceTransactionUuid: "refund", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "other", date: "2026-01-04", amount: -4, category: ["Otro", "Supermercado"], sourceTransactionUuid: "other", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "named", date: "2026-01-05", amount: -1, category: ["Sin categoría"], sourceTransactionUuid: "named", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "income", date: "2026-01-07", amount: 8, category: ["Ingresos"], sourceTransactionUuid: "income", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "cash-transfer", date: "2026-01-08", amount: -3, category: ["Transferencia"], sourceTransactionUuid: "cash-transfer", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "void", date: "2026-01-09", amount: -100, category: ["Gastos", "Comida", "Supermercado"], sourceTransactionUuid: "void", sourceStatus: "VOID", splitIndex: null, splitCount: null },
    ] },
    { uuid: "debt", label: "Deuda", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "debt-child", date: "2026-01-02", amount: -2, category: ["Gastos", "Comida", "Supermercado"], sourceTransactionUuid: "debt-child", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "debt-only", date: "2026-01-10", amount: -7, category: ["SoloDeuda"], sourceTransactionUuid: "debt-only", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "debt-transfer", date: "2026-01-08", amount: 3, category: ["Transferencia"], sourceTransactionUuid: "debt-transfer", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    ] },
  ],
};

const normalized = normalizeDataset(source);
const namedPosting = normalized.postings.find((posting) =>
  posting.categoryPath[0] === "Sin categoría",
);
// Backup imports can retain an empty category path; the direct AppDataset normalizer cannot.
const dataset: AnalyticsDataset = {
  ...normalized,
  postings: [
    ...normalized.postings,
    {
      ...namedPosting!,
      id: "cash:uncategorized",
      transactionId: "uncategorized",
      sourceTransactionId: "uncategorized",
      date: "2026-01-06",
      categoryPath: [],
      categoryType: "NEUTRAL",
      amountNativeMinor: -200,
      amountEurMinor: -200,
    },
  ],
};
const modelFor = (overrides: Partial<FilterState> = {}) =>
  createPerspectiveComparisonPageModel(dataset, { ...createDefaultFilterState(), ...overrides });

function findCategory(
  nodes: ReturnType<typeof modelFor>["categories"],
  path: readonly string[],
): (typeof nodes)[number] | undefined {
  const id = JSON.stringify(path);
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findCategory(node.children, path);
    if (child !== undefined) return child;
  }
  return undefined;
}

describe("perspective category comparison", () => {
  it("keeps parent direct amounts and deep signed rollups without double-counting or VOID", () => {
    const { categories } = modelFor();
    const parent = findCategory(categories, ["Gastos"]);
    const deep = findCategory(categories, ["Gastos", "Comida", "Supermercado"]);
    expect(parent?.amounts.realCashFlow.expensesEurMinor).toBe(-1_300);
    expect(parent?.amounts.all.expensesEurMinor).toBe(-1_500);
    expect(parent?.amounts.debtsOnly.expensesEurMinor).toBe(200);
    expect(deep?.amounts.realCashFlow.expensesEurMinor).toBe(-300);
    expect(deep?.amounts.all.expensesEurMinor).toBe(-500);
    expect(deep?.amounts.debtsOnly.expensesEurMinor).toBe(200);
    expect(findCategory(categories, ["SoloDeuda"])?.amounts.realCashFlow.netEurMinor).toBe(0);
    expect(findCategory(categories, ["SoloDeuda"])?.amounts.debtsOnly.netEurMinor).toBe(700);
    expect(findCategory(categories, ["Transferencia"])?.amounts).toMatchObject({
      realCashFlow: { transfersEurMinor: -300 },
      all: { transfersEurMinor: 0 },
      debtsOnly: { transfersEurMinor: -300 },
    });
  });

  it("distinguishes identical leaf names under different paths and uncategorized from a named category", () => {
    const { categories } = modelFor();
    expect(findCategory(categories, ["Gastos", "Comida", "Supermercado"])?.id)
      .not.toBe(findCategory(categories, ["Otro", "Supermercado"])?.id);
    expect(findCategory(categories, [])?.amounts.all.netEurMinor).toBe(-200);
    expect(findCategory(categories, ["Sin categoría"])?.amounts.all.netEurMinor).toBe(-100);
    expect(categories.map((node) => node.id)).toEqual(expect.arrayContaining(["[]", '["Sin categoría"]']));
  });

  it("preserves account, period, search and category filters with inert legacy statuses", () => {
    const filters: Partial<FilterState> = {
      accountIds: ["cash"],
      dateRange: { from: "2026-01-01", to: "2026-01-03" },
      categoryPrefixes: [["Gastos"]],
      categoryDepth: "exact",
      scope: "debtsOnly",
    };
    const exact = modelFor(filters).categories;
    expect(findCategory(exact, ["Gastos"])?.amounts.all.netEurMinor).toBe(-1_000);
    expect(findCategory(exact, ["Gastos"])?.children).toEqual([]);
    expect(findCategory(exact, ["SoloDeuda"])).toBeUndefined();

    const subtree = modelFor({ ...filters, categoryDepth: "subtree" }).categories;
    expect(findCategory(subtree, ["Gastos"])?.amounts.all.netEurMinor).toBe(-1_300);
    expect(findCategory(subtree, ["Gastos", "Comida", "Supermercado"])?.amounts.debtsOnly.netEurMinor).toBe(0);

    const searched = modelFor({ ...filters, categoryDepth: "subtree", search: "Mercado", statuses: ["CLEARED"] }).categories;
    // Search also matches the category path, so both the expense and its refund remain.
    expect(findCategory(searched, ["Gastos"])?.amounts.all.netEurMinor).toBe(-300);
    expect(findCategory(searched, ["Gastos"])?.amounts.debtsOnly.netEurMinor).toBe(0);
    expect(modelFor({ statuses: ["VOID"] }).categories).toEqual(modelFor().categories);
  });

  it("shows every depth with non-selectable names and switches all four signed metrics locally", async () => {
    const user = userEvent.setup();
    const model = modelFor();
    render(<PerspectiveComparisonPageView {...model} searchPending={false} />);
    const selector = screen.getByRole("combobox", { name: "Métrica de categorías" });
    expect(selector).toHaveValue("netEurMinor");
    expect(screen.queryByRole("button", { name: /Filtrar|Quitar filtro/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contraer Gastos" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Desplegar Gastos › Comida" }));
    const branch = screen.getByRole("button", { name: "Contraer Gastos › Comida" }).closest("li");
    const deep = within(branch!).getByText("Gastos › Comida › Supermercado", { selector: "span" }).closest("li");
    expect(deep).not.toBeNull();
    expect(within(deep!).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Yo", "Ajuste por deudas", "Flujo real",
    ]);
    expect(within(deep!).getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "-5,00 €", "2,00 €", "-3,00 €",
    ]);
    expect(within(deep!).getByText(/-3,00/)).toBeVisible();
    await user.selectOptions(selector, "incomesEurMinor");
    expect(within(deep!).getAllByText(/0,00/)).toHaveLength(3);
    await user.selectOptions(selector, "expensesEurMinor");
    expect(within(deep!).getByText(/-5,00/)).toBeVisible();
    await user.selectOptions(selector, "transfersEurMinor");
    expect(within(deep!).getAllByText(/0,00/)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Filtrar|Quitar filtro/ })).not.toBeInTheDocument();
  });

  it("keeps the overview and gives an explicit empty category state", () => {
    const model = modelFor({ dateRange: { from: "2027-01-01", to: "2027-01-31" } });
    render(<PerspectiveComparisonPageView {...model} searchPending={false} />);
    expect(screen.getByRole("table", { name: /Comparación de movimientos/ })).toBeVisible();
    expect(screen.getByText(/No hay movimientos en el periodo/)).toBeVisible();
    expect(screen.getByText(/No hay categorías con actividad/)).toBeVisible();
  });
});
