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
import { createCategoriesPageModel } from "./CategoriesPage.helpers.ts";
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
  it("applies and clears a category through global-filter callbacks", async () => {
    const user = userEvent.setup();
    const onClearCategory = vi.fn<() => void>();
    const onSelectCategory = vi.fn<(path: readonly string[]) => void>();
    render(
      <CategoriesPageView
        activityEurMinor={-2_500}
        categoryBars={[]}
        categorySeries={[]}
        directPostingCount={4}
        expenseEurMinor={2_500}
        flattenedCategories={[category]}
        onClearCategory={onClearCategory}
        onSelectCategory={onSelectCategory}
        selectedCategory={category}
        showClearCategory
      />,
    );

    const selectedButton = screen.getByRole("button", { name: /Gastos/ });
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    await user.click(selectedButton);
    expect(onSelectCategory).toHaveBeenCalledWith(["Gastos"]);
    expect(screen.getByText("Gasto")).toBeVisible();
    expect(screen.getByText("4 dir. / 4 total")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Ver todas las categorías" }),
    );
    expect(onClearCategory).toHaveBeenCalledOnce();
  });
});

describe("createCategoriesPageModel", () => {
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
      categoryPrefix: selectedPath,
    });

    const model = createCategoriesPageModel(
      analytics,
      filtered,
      selectedPath,
      "year",
      vi.fn<() => void>(),
      vi.fn<(path: readonly string[]) => void>(),
    );

    expect(model.categorySeries).toHaveLength(1);
    expect(model.categorySeries[0]?.label).toBe("Comida");
    expect(model.categorySeries[0]?.data).toEqual([
      expect.objectContaining({ label: "2026", value: -10 }),
    ]);
    expect(model.categoryBars).toEqual([
      expect.objectContaining({
        label: "Gastos › Comida",
        value: 10,
      }),
    ]);

    const completeTreeModel = createCategoriesPageModel(
      analytics,
      applyFilters(analytics, createDefaultFilterState()),
      [],
      "year",
      vi.fn<() => void>(),
      vi.fn<(path: readonly string[]) => void>(),
    );
    expect(completeTreeModel.directPostingCount).toBe(1);
  });
});
