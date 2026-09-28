import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AmountSummary,
  AppDataset,
  CategoryBreakdownNode,
} from "../../../domain/analytics/types.ts";
import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import { createCategoriesPageModel, createCategoryDrilldownFilters } from "./CategoriesPage.helpers.ts";
import { CategoriesPageView } from "./CategoriesPage.view.tsx";

const summary: AmountSummary = {
  debtFlowEurMinor: 0,
  expensesEurMinor: -2_500,
  incomesEurMinor: 0,
  netEurMinor: -2_500,
  postingCount: 4,
  realCashFlowEurMinor: -2_500,
  transfersEurMinor: 0,
};

const category: CategoryBreakdownNode = {
  categoryType: "EXPENSE",
  children: [],
  directSummary: summary,
  id: "Gastos",
  name: "Gastos",
  path: ["Gastos"],
  summary,
};

describe("CategoriesPageView", () => {
  it.each([
    { unit: "month" as const, to: "2025-01-31" as const, label: "mes" },
    { unit: "year" as const, to: "2025-12-31" as const, label: "año" },
  ])("uses singular wording for one $unit divisor", async ({ unit, to, label }) => {
    const user = userEvent.setup();
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "jan", date: "2025-01-15", amount: -10, category: ["Gastos"], sourceTransactionUuid: "jan", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const filters = { ...createDefaultFilterState(), dateRange: { from: "2025-01-01" as const, to } };
    const model = createCategoriesPageModel(analytics, applyFilters(analytics, filters), [], unit, vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, "2026-09-27");

    expect(model.completedPeriodCount).toBe(1);
    render(<CategoriesPageView {...model} />);
    await user.click(screen.getByText("Cómo se calcula el promedio"));
    expect(screen.getByText(`Divisor: 1 ${label} completo, incluidos los períodos sin actividad.`)).toBeVisible();
  });

  it("applies and clears a category through global-filter callbacks", async () => {
    const user = userEvent.setup();
    const onClearCategory = vi.fn<() => void>();
    const onToggleCategory = vi.fn<(path: readonly string[]) => void>();
    render(
      <CategoriesPageView
        activityEurMinor={-2_500}
        averageUnit="month"
        averageScope="filtered"
        averageExplanation={{
          selectedWindow: { from: null, to: null, includedWindow: null, completedPeriodCount: 1, excludedPeriods: [], futureExcluded: false },
          appliedWindow: { from: null, to: null, includedWindow: null, completedPeriodCount: 1, excludedPeriods: [], futureExcluded: false },
          fallbackReason: null,
          dateBasis: "operation",
        }}
        categoryAverageEurMinorById={new Map([[category.id, -2_500]])}
        categoryBars={[]}
        categoryCount={1}
        categorySeries={[]}
        categoryTree={[category]}
        completedPeriodCount={1}
        directPostingCount={4}
        expenseEurMinor={2_500}
        onClearCategory={onClearCategory}
        onToggleCategory={onToggleCategory}
        selectedCategoryIds={new Set([category.id])}
        selectionDetail="Gastos"
        showClearCategory
      />,
    );

    const selectedButton = screen.getByRole("button", {
      name: "Quitar filtro: Gastos",
    });
    const tree = screen.getByRole("region", { name: "Explorador jerárquico" });
    const comparison = screen.getByRole("region", { name: "Consultar categorías" });
    expect(tree.compareDocumentPosition(comparison) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    await user.click(selectedButton);
    expect(onToggleCategory).toHaveBeenCalledWith(["Gastos"]);
    expect(screen.getByText("Gasto")).toBeVisible();
    expect(screen.getByText("4 dir. / 4 total")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Ver todas las categorías" }),
    );
    expect(onClearCategory).toHaveBeenCalledOnce();
  });
});

describe("createCategoriesPageModel", () => {
  it("aligns filtered flow series across disjoint category activity", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { A: { categoryType: "EXPENSE" }, B: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "jan", date: "2026-01-10", amount: -10, category: ["A"], sourceTransactionUuid: "jan", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "mar", date: "2026-03-10", amount: -20, category: ["B"], sourceTransactionUuid: "mar", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const modelFor = (dateRange: { from: `${number}-${number}-${number}` | null; to: `${number}-${number}-${number}` | null }) =>
      createCategoriesPageModel(analytics, applyFilters(analytics, { ...createDefaultFilterState(), dateRange }), [], "month", vi.fn(), vi.fn(),
        { metric: "netEurMinor", level: "roots", seriesLimit: 0 });
    const unbounded = modelFor({ from: null, to: null });
    expect(unbounded.categorySeries.find(({ label }) => label === "A")?.data).toEqual([
      { label: "2026-01", value: -10 }, { label: "2026-02", value: 0 }, { label: "2026-03", value: 0 },
    ]);
    expect(unbounded.categorySeries.find(({ label }) => label === "B")?.data).toEqual([
      { label: "2026-01", value: 0 }, { label: "2026-02", value: 0 }, { label: "2026-03", value: -20 },
    ]);
    expect(modelFor({ from: "2026-02-01", to: null }).categorySeries[0]?.data).toEqual([
      { label: "2026-02", value: 0 }, { label: "2026-03", value: -20 },
    ]);
  });

  it("discloses a shared completed-month divisor beside unchanged parent and child totals", async () => {
    const user = userEvent.setup();
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE", children: { Comida: { categoryType: "EXPENSE" } } } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "annual", date: "2025-01-10", amount: -1200, category: ["Gastos", "Comida"], sourceTransactionUuid: "annual", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const filters = { ...createDefaultFilterState(), dateRange: { from: "2025-01-01" as const, to: "2025-12-31" as const } };
    const model = createCategoriesPageModel(analytics, applyFilters(analytics, filters), [], "month", vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, "2026-09-27");

    expect(model.completedPeriodCount).toBe(12);
    expect(model.categoryTree[0]?.summary.netEurMinor).toBe(-120_000);
    expect(model.categoryAverageEurMinorById.get('["Gastos","Comida"]')).toBe(-10_000);
    render(<CategoriesPageView {...model} />);
    expect(screen.getAllByText("Cómo se calcula el promedio")).toHaveLength(1);
    const disclosure = screen.getByText("Cómo se calcula el promedio");
    expect(disclosure.tagName).toBe("SUMMARY");
    expect(disclosure).toHaveAccessibleName("Cómo se calcula el promedio");
    disclosure.focus();
    expect(disclosure).toHaveFocus();
    await user.click(disclosure);
    expect(disclosure.closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/12 meses completos.*sin actividad/)).toBeVisible();
    expect(screen.getByText(/Ventana incluida:.*01\/01\/2025.*31\/12\/2025/)).toBeVisible();
    expect(screen.getAllByText(/Promedio:.*100,00.*mes/)).toHaveLength(2);
    expect(screen.getAllByText(/-1200,00/).length).toBeGreaterThanOrEqual(2);
  });

  it("explains no-history state instead of zero while retaining the current-day total", async () => {
    const user = userEvent.setup();
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "today", date: "2026-09-27", amount: -50, category: ["Gastos"], sourceTransactionUuid: "today", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const filters = { ...createDefaultFilterState(), dateRange: { from: "2026-09-27" as const, to: "2026-09-27" as const } };
    const model = createCategoriesPageModel(analytics, applyFilters(analytics, filters), [], "day", vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, "2026-09-27");

    expect(model.completedPeriodCount).toBe(0);
    expect(model.categoryTree[0]?.summary.netEurMinor).toBe(-5_000);
    render(<CategoriesPageView {...model} />);
    await user.click(screen.getByText("Cómo se calcula el promedio"));
    expect(screen.getByText(/La selección no contiene unidades completas/)).toBeVisible();
    expect(screen.getByText(/Sin períodos completos: no se calcula/)).toBeVisible();
    expect(screen.getAllByText(/Ventana incluida: ninguna/)).toHaveLength(2);
    expect(screen.getByText("Sin períodos completos")).toBeVisible();
    expect(screen.getAllByText(/50,00/).length).toBeGreaterThan(0);
  });

  it("explains the historical fallback and keeps the current tree, total, and chart unchanged", async () => {
    const user = userEvent.setup();
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Expenses: { categoryType: "EXPENSE", children: { Food: { categoryType: "EXPENSE" }, Rent: { categoryType: "EXPENSE" } } } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "historic", date: "2025-01-01", amount: -100, category: ["Expenses", "Food"], sourceTransactionUuid: "historic", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "current", date: "2026-09-10", amount: -500, category: ["Expenses", "Rent"], sourceTransactionUuid: "current", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const selected = [["Expenses", "Rent"]];
    const filters = { ...createDefaultFilterState(), periodMode: "month" as const, categoryPrefixes: selected, dateRange: { from: "2026-09-01" as const, to: "2026-09-27" as const } };
    const model = createCategoriesPageModel(analytics, applyFilters(analytics, filters), selected, "month", vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, "2026-09-27");

    expect(model.averageScope).toBe("historical");
    expect(model.completedPeriodCount).toBe(20);
    expect(model.categoryTree[0]?.children.map(({ name }) => name)).toEqual(["Rent"]);
    expect(model.categoryTree[0]?.summary.netEurMinor).toBe(-50_000);
    expect(model.categoryBars).toEqual([expect.objectContaining({ value: -500 })]);
    expect(model.categoryAverageEurMinorById.get('["Expenses","Rent"]') ?? 0).toBe(0);
    render(<CategoriesPageView {...model} />);
    await user.click(screen.getByText("Cómo se calcula el promedio"));
    expect(screen.getByText(/La unidad elegida coincide con el período seleccionado/)).toBeVisible();
    expect(screen.getByText(/Historial utilizado/)).toBeVisible();
    expect(screen.getByText(/Ventana incluida:.*01\/01\/2025.*31\/08\/2026/)).toBeVisible();
    expect(screen.getAllByText(/no terminó antes de hoy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Promedio histórico:.*mes.*20 períodos completos/)).toHaveLength(2);
  });

  it("recalculates with date/granularity while preserving the tree's broader category scope", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE", children: { Comida: { categoryType: "EXPENSE" }, Casa: { categoryType: "EXPENSE" } } } },
      parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "food", date: "2025-01-10", amount: -120, category: ["Gastos", "Comida"], sourceTransactionUuid: "food", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "home", date: "2025-02-10", amount: -240, category: ["Gastos", "Casa"], sourceTransactionUuid: "home", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const base = createDefaultFilterState();
    const selection = [["Gastos", "Comida"]];
    const modelFor = (from: "2025-01-01" | "2025-02-01", granularity: "month" | "year") => {
      const filters = { ...base, categoryPrefixes: selection, dateRange: { from, to: "2025-12-31" as const } };
      return createCategoriesPageModel(analytics, applyFilters(analytics, filters), selection, granularity, vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, "2026-09-27");
    };
    const monthly = modelFor("2025-01-01", "month");
    const all = createCategoriesPageModel(analytics, applyFilters(analytics, { ...createDefaultFilterState(), dateRange: { from: "2025-01-01", to: "2025-12-31" } }), [], "month", vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, "2026-09-27");
    expect(monthly.averageExplanation.appliedWindow).toEqual(all.averageExplanation.appliedWindow);
    expect(monthly.categoryBars[0]?.value).toBe(-120);
    expect(monthly.categoryTree[0]?.summary.netEurMinor).toBe(-36_000);
    expect(monthly.categoryAverageEurMinorById.get('["Gastos","Comida"]')).toBe(-1_000);
    expect(monthly.categoryAverageEurMinorById.get('["Gastos","Casa"]')).toBe(-2_000);

    const later = modelFor("2025-02-01", "month");
    expect(later.completedPeriodCount).toBe(11);
    expect(later.categoryTree[0]?.summary.netEurMinor).toBe(-24_000);
    expect(later.categoryAverageEurMinorById.get('["Gastos","Casa"]')).toBe(-24_000 / 11);
    const yearly = modelFor("2025-01-01", "year");
    expect(yearly.completedPeriodCount).toBe(1);
    expect(yearly.categoryAverageEurMinorById.get('["Gastos","Comida"]')).toBe(-12_000);
  });

  it("does not broaden a chart partition admitted through its counterpart category", () => {
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" }, debt: { label: "Deuda", type: "DEBT" } } },
      categories: { Compra: { categoryType: "EXPENSE" }, Reparto: { categoryType: "EXPENSE" } },
      parsedData: [
        { uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: [
          { uuid: "purchase", date: "2026-01-01", amount: -10, category: ["Compra"], sourceTransactionUuid: "purchase", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
          { uuid: "unrelated", date: "2026-01-01", amount: -5, category: ["Reparto"], sourceTransactionUuid: "unrelated", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        ] },
        { uuid: "debt", label: "Deuda", currency: "EUR", openingBalance: 0, transactions: [
          { uuid: "peer", date: "2026-01-01", amount: 10, category: ["Reparto"], sourceTransactionUuid: "peer", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        ] },
      ],
    });
    const purchaseId = initial.postings.find(({ transactionId }) => transactionId === "purchase")!.id;
    const peerId = initial.postings.find(({ transactionId }) => transactionId === "peer")!.id;
    const analytics = structuredClone(initial);
    for (const posting of analytics.postings) {
      if (posting.transactionId !== "unrelated") {
        Object.assign(posting, { linked: true, transferPeerPostingId: posting.transactionId === "purchase" ? peerId : purchaseId });
      }
    }
    const filters = { ...createDefaultFilterState(), categoryPrefixes: [["Compra"]], categoryDepth: "exact" as const, categoryMatch: "either" as const };
    const filtered = applyFilters(analytics, filters);
    const model = createCategoriesPageModel(analytics, filtered, filters.categoryPrefixes, "month", vi.fn(), vi.fn(), undefined, undefined, vi.fn());

    expect(filtered.postings.map(({ transactionId }) => transactionId).toSorted()).toEqual(["peer", "purchase"]);
    expect(model.categoryBars.find(({ label }) => label === "Reparto")?.value).toBe(10);
    expect(model.onViewCategory).toBeUndefined();
  });

  it("keeps uncategorized postings in a separate selectable chart partition", async () => {
    const user = userEvent.setup();
    const initial = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "categorized", date: "2026-01-01", amount: -10, category: ["Gastos"], sourceTransactionUuid: "categorized", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "uncategorized", date: "2026-01-02", amount: -20, category: ["Gastos"], sourceTransactionUuid: "uncategorized", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const analytics = structuredClone(initial);
    for (const posting of analytics.postings) {
      if (posting.transactionId === "uncategorized") Object.assign(posting, { categoryPath: [] });
    }
    const onToggle = vi.fn<(path: readonly string[]) => void>();
    const model = createCategoriesPageModel(analytics, applyFilters(analytics, createDefaultFilterState()), [], "month", vi.fn(), onToggle);

    expect(model.activityEurMinor).toBe(-3_000);
    expect(model.categoryBars.find(({ id }) => id === "[]")).toMatchObject({ label: "Sin categoría", value: -20 });
    expect(model.categorySeries.find(({ id }) => id === "[]")?.data).toEqual([{ label: "2026-01", value: -20 }]);
    render(<CategoriesPageView {...model} />);
    await user.click(screen.getByRole("button", { name: "Filtrar: Sin categoría" }));
    expect(onToggle).toHaveBeenCalledWith([]);

    const selected = [[], ["Gastos"]];
    const selection = createCategoriesPageModel(analytics, applyFilters(analytics, { ...createDefaultFilterState(), categoryPrefixes: selected }), selected, "month", vi.fn(), onToggle);
    expect(selection.categoryBars).toHaveLength(2);
    expect(selection.categoryBars.reduce((sum, bar) => sum + bar.value, 0)).toBe(-30);
  });

  it("does not display a net expense credit as positive spending", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "refund", date: "2026-01-01", amount: 20, category: ["Gastos"], sourceTransactionUuid: "refund", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const model = createCategoriesPageModel(analytics, applyFilters(analytics, createDefaultFilterState()), [], "month", vi.fn(), vi.fn());
    expect(model.expenseEurMinor).toBe(-2_000);
    expect(model.categoryBars[0]?.value).toBe(20);
    expect(model.categoryBars[0]?.color).toBe("#a33f36");
    expect(model.categorySeries[0]?.color).toBe(model.categoryBars[0]?.color);
  });

  it("keeps the comparison series inside the selected subcategory", () => {
    const source: AppDataset = {
      accounts: {
        version: 2,
        accounts: {
          cash: { label: "Cuenta", type: "DEFAULT" },
        },
      },
      categories: {
        Gastos: {
          categoryType: "EXPENSE",
          children: {
            Casa: { categoryType: "EXPENSE" },
            Comida: { categoryType: "EXPENSE" },
          },
        },
      },
      parsedData: [
        {
          uuid: "cash",
          label: "Cuenta",
          currency: "EUR",
          openingBalance: 0,
          transactions: [
            {
              uuid: "food",
              date: "2026-01-01",
              amount: -10,
              category: ["Gastos", "Comida"],
              sourceTransactionUuid: "food",
              sourceStatus: "RECONCILED",
              splitIndex: null,
              splitCount: null,
            },
            {
              uuid: "home",
              date: "2026-01-02",
              amount: -20,
              category: ["Gastos", "Casa"],
              sourceTransactionUuid: "home",
              sourceStatus: "RECONCILED",
              splitIndex: null,
              splitCount: null,
            },
            {
              uuid: "root-expense",
              date: "2026-01-03",
              amount: -5,
              category: ["Gastos"],
              sourceTransactionUuid: "root-expense",
              sourceStatus: "RECONCILED",
              splitIndex: null,
              splitCount: null,
            },
          ],
        },
      ],
    };
    const analytics = normalizeDataset(source);
    const selectedPath = ["Gastos", "Comida"] as const;
    const filtered = applyFilters(analytics, {
      ...createDefaultFilterState(),
      categoryPrefixes: [selectedPath],
    });

    const model = createCategoriesPageModel(
      analytics,
      filtered,
      [selectedPath],
      "year",
      vi.fn<() => void>(),
      vi.fn<(path: readonly string[]) => void>(),
    );

    expect(model.categorySeries).toHaveLength(1);
    expect(model.categorySeries[0]?.label).toBe("Gastos › Comida");
    expect(model.categorySeries[0]?.data).toEqual([
      expect.objectContaining({ label: "2026", value: -10 }),
    ]);
    expect(model.categoryBars).toEqual([
      expect.objectContaining({
        label: "Gastos › Comida",
        value: -10,
      }),
    ]);
    expect(model.categoryTree[0]?.children.map(({ name }) => name)).toEqual([
      "Casa",
      "Comida",
    ]);
    expect(model.selectedCategoryIds.has('["Gastos","Comida"]')).toBe(true);

    const completeTreeModel = createCategoriesPageModel(
      analytics,
      applyFilters(analytics, createDefaultFilterState()),
      [],
      "year",
      vi.fn<() => void>(),
      vi.fn<(path: readonly string[]) => void>(),
    );
    expect(completeTreeModel.directPostingCount).toBe(3);
    expect(completeTreeModel.categoryBars).toEqual([
      expect.objectContaining({ label: "Gastos", value: -35 }),
    ]);

    const directModel = createCategoriesPageModel(
      analytics, applyFilters(analytics, createDefaultFilterState()), [], "year", vi.fn(), vi.fn(),
      { metric: "realCashFlowEurMinor", level: "direct", seriesLimit: 0 },
    );
    expect(directModel.categoryBars.map(({ value }) => value)).toEqual([-20, -10, -5]);
    expect(directModel.categorySeries.map(({ data }) => data[0]?.value)).toEqual([-20, -10, -5]);
    expect(directModel.categoryBars.reduce((sum, bar) => sum + bar.value, 0)).toBe(-35);

    const exactRoot = applyFilters(analytics, {
      ...createDefaultFilterState(), categoryPrefixes: [["Gastos"]], categoryDepth: "exact",
    });
    const exactRootModel = createCategoriesPageModel(analytics, exactRoot, [["Gastos"]], "year", vi.fn(), vi.fn());
    expect(exactRootModel.categoryBars[0]?.value).toBe(-5);
    expect(exactRootModel.categorySeries[0]?.data[0]?.value).toBe(-5);

    // An exact-depth control without selected paths does not filter the chart.
    const unconstrainedExact = { ...createDefaultFilterState(), categoryDepth: "exact" as const };
    const rootDrilldown = applyFilters(analytics, {
      ...unconstrainedExact,
      ...createCategoryDrilldownFilters(unconstrainedExact, ["Gastos"], "roots"),
    });
    expect(rootDrilldown.postings).toHaveLength(3);

    // A root bar can aggregate several exact selections; retain their union.
    const exactPaths = { ...unconstrainedExact, categoryPrefixes: [["Gastos"], ["Gastos", "Comida"]] };
    const selectedRootDrilldown = applyFilters(analytics, {
      ...exactPaths,
      ...createCategoryDrilldownFilters(exactPaths, ["Gastos"], "roots"),
    });
    expect(selectedRootDrilldown.postings.map(({ transactionId }) => transactionId).toSorted()).toEqual(["food", "root-expense"]);
    const directDrilldown = applyFilters(analytics, {
      ...exactPaths,
      ...createCategoryDrilldownFilters(exactPaths, ["Gastos"], "direct"),
    });
    expect(directDrilldown.postings.map(({ transactionId }) => transactionId)).toEqual(["root-expense"]);
  });

  it("never silently drops a selected category beyond the fourth series", () => {
    const paths = Array.from({ length: 6 }, (_, index) => ["Gastos", `Grupo ${index}`]);
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE", children: Object.fromEntries(paths.map((path) => [path[1], { categoryType: "EXPENSE" }])) } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: paths.map((categoryPath, index) => ({
        uuid: `p${index}`, date: "2026-01-01", amount: -(index + 1), category: categoryPath,
        sourceTransactionUuid: `p${index}`, sourceStatus: "RECONCILED", splitIndex: null, splitCount: null,
      })) }],
    });
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), categoryPrefixes: paths });
    const model = createCategoriesPageModel(analytics, filtered, paths, "month", vi.fn(), vi.fn());
    expect(model.categoryBars).toHaveLength(6);
    expect(model.categorySeries).toHaveLength(6);
  });
});
