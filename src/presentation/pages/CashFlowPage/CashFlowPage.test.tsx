import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import type { AppDataset, KpiSummary } from "../../../domain/analytics/types.ts";
import { createCashFlowPageModel } from "./CashFlowPage.helpers.ts";
import { CashFlowPageView } from "./CashFlowPage.view.tsx";

const kpis: KpiSummary = {
  accountCount: 1,
  debtFlowEurMinor: 0,
  expenseRefundsEurMinor: 250,
  expensesEurMinor: -3_750,
  grossExpensesEurMinor: 4_000,
  grossIncomeEurMinor: 8_000,
  incomeReversalsEurMinor: 0,
  incomesEurMinor: 8_000,
  netEurMinor: 4_250,
  netExpensesEurMinor: -3_750,
  netIncomeEurMinor: 8_000,
  netTransfersEurMinor: 0,
  periodClosingBalanceEurMinor: 14_250,
  periodOpeningBalanceEurMinor: 10_000,
  postingCount: 4,
  realCashFlowEurMinor: 4_250,
  transferInflowsEurMinor: 0,
  transferOutflowsEurMinor: 0,
  transfersEurMinor: 0,
};

describe("CashFlowPageView", () => {
  it("shows cash-flow KPIs and both period comparisons", () => {
    render(
      <CashFlowPageView
        composition={{
          expenseRefundsEurMinor: 250,
          grossExpensesEurMinor: 4_000,
          grossIncomeEurMinor: 8_000,
          incomeReversalsEurMinor: 0,
          netExpensesEurMinor: -3_750,
          netIncomeEurMinor: 8_000,
          netTransfersEurMinor: 0,
          transferInflowsEurMinor: 0,
          transferOutflowsEurMinor: 0,
        }}
        expenseCategories={[]}
        kpis={kpis}
        lineSeries={[]}
        periodBars={[]}
        savingsEurMinor={4_250}
      />,
    );

    expect(screen.getByText("Flujo real")).toBeVisible();
    expect(screen.getByText("Flujo neto por periodo")).toBeVisible();
    expect(screen.getByText("Tensión entre entradas y salidas")).toBeVisible();
    expect(screen.getByText("Presión por categoría")).toBeVisible();
  });

  it("includes negative neutral roots in expense pressure", () => {
    const source: AppDataset = {
      accounts: {
        version: 2,
        accounts: { cash: { label: "Cuenta", type: "DEFAULT" } },
      },
      categories: {
        Gastos: { categoryType: "EXPENSE" },
        "Reajuste*": { categoryType: "NEUTRAL" },
      },
      parsedData: [
        {
          uuid: "cash",
          label: "Cuenta",
          currency: "EUR",
          openingBalance: 0,
          transactions: [
            {
              uuid: "expense",
              date: "2026-01-01",
              amount: -10,
              category: ["Gastos"],
              sourceTransactionUuid: "expense",
              sourceStatus: "RECONCILED",
              splitIndex: null,
              splitCount: null,
            },
            {
              uuid: "adjustment",
              date: "2026-01-02",
              amount: -5,
              category: ["Reajuste*"],
              sourceTransactionUuid: "adjustment",
              sourceStatus: "RECONCILED",
              splitIndex: null,
              splitCount: null,
            },
          ],
        },
      ],
    };
    const model = createCashFlowPageModel(
      applyFilters(normalizeDataset(source), createDefaultFilterState()),
      "year",
    );

    expect(model.expenseCategories.map((category) => category.name)).toEqual([
      "Gastos",
      "Reajuste*",
    ]);
  });
});
