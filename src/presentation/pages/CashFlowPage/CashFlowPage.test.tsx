import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("distinguishes signed real flow and shows active debt adjustments beside the composition", async () => {
    render(
      <CashFlowPageView
        composition={{
          expenseRefundsEurMinor: 250,
          debtExpenseAdjustmentsEurMinor: 125,
          debtIncomeAdjustmentsEurMinor: 75,
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
        kpis={{ ...kpis, realCashFlowEurMinor: -200 }}
        lineSeries={[]}
        periodBars={[]}
        savingsEurMinor={4_250}
      />,
    );
    const real = screen.getByText("Flujo real").closest("article");
    expect(real).not.toBeNull();
    expect(within(real!).getByText(/-2,00\s€/)).toBeVisible();
    expect(screen.getByText("Resultado consolidado").parentElement).toHaveTextContent(/42,50\s€/);
    expect(screen.getByText(/El flujo real usa cuentas sin deuda e incluye pagos transferidos hacia cuentas de deuda/)).toBeVisible();
    expect(screen.getByText(/se compensan en el neto cuando ambos extremos/)).toBeVisible();
    expect(screen.getByText(/no equivale al efectivo disponible/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Flujo neto por periodo" })).toBeVisible();
    expect(screen.getByText("Presión por categoría").closest("details")).not.toHaveAttribute("open");
    const information = screen.getByText("Información del flujo de caja");
    expect(information.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Flujo neto por periodo" }).compareDocumentPosition(information) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    await userEvent.setup().click(screen.getByText("Composición del flujo"));
    const composition = screen.getByText("Composición del flujo").closest("details");
    expect(composition).toHaveAttribute("open");
    expect(within(composition!).getByText(/Asignación de gasto en deudas: 1,25\s*€; no es una devolución/)).toBeVisible();
    expect(within(composition!).getByText(/Asignación de ingreso en deudas: 0,75\s*€; no es una reversión de ingreso/)).toBeVisible();
    expect(information.closest("details")).not.toHaveAttribute("open");
  });

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
    expect(screen.getByText("Presión por categoría")).toBeInTheDocument();
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

  it("plots real receipts and payments including transfers, never an absolute-value expense refund", async () => {
    const filtered = applyFilters(normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Gastos: { categoryType: "EXPENSE" }, Transferencia: { categoryType: "TRANSFER" } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "refund", date: "2026-01-01", amount: 3, category: ["Gastos"], sourceTransactionUuid: "refund", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
        { uuid: "payment", date: "2026-01-02", amount: -5, category: ["Transferencia"], sourceTransactionUuid: "payment", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      ] }],
    }), createDefaultFilterState());
    const model = createCashFlowPageModel(filtered, "month");
    expect(model.periodBars).toMatchObject([{ leftValue: 5, rightValue: 3 }]);
    expect(model.kpis.realCashFlowEurMinor).toBe(-200);
    render(<CashFlowPageView {...model} />);
    expect(screen.getByRole("button", { name: /Salidas reales/ })).toBeVisible();
    await userEvent.setup().click(screen.getByText("Composición del flujo"));
    expect(screen.getByText(
      "Un importe negativo puede deberse a devoluciones o a asignaciones en deudas, no a un gasto adicional.",
      { exact: false, selector: "p" },
    )).toBeVisible();
  });
});
