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
const emptyTrendFiltered = applyFilters(normalizeDataset({
  accounts: { version: 2, accounts: { cash: { label: "Bank", type: "DEFAULT" } } },
  categories: {},
  parsedData: [],
}), createDefaultFilterState());

describe("CashFlowPageView", () => {
  it("reveals an eligible monthly accounting savings trend only while its disclosure is open", async () => {
    const source = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Bank", type: "DEFAULT" } } },
      categories: { Income: { categoryType: "INCOME" }, Expense: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Bank", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "jan", date: "2024-01-15", amount: -1, category: ["Expense"], sourceTransactionUuid: "jan", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "income", date: "2024-02-10", amount: 100, category: ["Income"], sourceTransactionUuid: "income", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "expense", date: "2024-02-11", amount: -25, category: ["Expense"], sourceTransactionUuid: "expense", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "refund", date: "2024-02-12", amount: 5, category: ["Expense"], sourceTransactionUuid: "refund", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "mar", date: "2024-03-10", amount: 1, category: ["Income"], sourceTransactionUuid: "mar", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const filtered = applyFilters(source, createDefaultFilterState());
    const user = userEvent.setup();
    render(<CashFlowPageView {...createCashFlowPageModel(filtered, "month")} />);
    const summary = screen.getByText("Tendencia mensual");
    const disclosure = summary.closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.queryByRole("heading", { name: "Tasa mensual de ahorro contable" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Detalle mensual del ahorro contable" })).toBeNull();
    await user.click(summary);
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Tasa mensual de ahorro contable" })).toBeVisible();
    const table = screen.getByRole("table", { name: "Detalle mensual del ahorro contable" });
    expect(within(table).getByText(/80\s*%/)).toBeVisible();
    expect(within(table).getByText(/100,00\s*€/)).toBeVisible();
    expect(within(table).getByText(/-20,00\s*€/)).toBeVisible();
    await user.click(summary);
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.queryByRole("heading", { name: "Tasa mensual de ahorro contable" })).toBeNull();
  });

  it.each(["realCashFlow", "debtsOnly", "all"] as const)("explains missing complete months for %s", async (scope) => {
    const user = userEvent.setup();
    const filtered = applyFilters(emptyTrendFiltered.source, { ...createDefaultFilterState(), scope });
    render(<CashFlowPageView {...createCashFlowPageModel(filtered, "month")} />);
    await user.click(screen.getByText("Tendencia mensual"));
    expect(screen.getByText(/No hay meses calendario completos/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Tasa mensual de ahorro contable" })).toBeNull();
    expect(screen.getByText(/Las fechas observadas no garantizan/)).toBeVisible();
  });

  it("suppresses the trend when requested status filters are present even though chart metrics ignore status", async () => {
    const user = userEvent.setup();
    render(<CashFlowPageView {...createCashFlowPageModel(emptyTrendFiltered, "month", ["RECONCILED"])} />);
    await user.click(screen.getByText("Tendencia mensual"));
    expect(screen.getByText(/No disponible con filtros de cuentas o contenido/)).toBeVisible();
  });

  it("switches between Real cash retention, Yo accounting savings and Debt ledger variation while open", async () => {
    const source = normalizeDataset({
      accounts: { version: 2, accounts: {
        cash: { label: "Cash", type: "DEFAULT" }, partner: { label: "Attributed", type: "DEBT" },
      } },
      categories: { Income: { categoryType: "INCOME" }, Expense: { categoryType: "EXPENSE" } },
      parsedData: [
        { uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
          { uuid: "jan", date: "2024-01-15", amount: -1, category: ["Expense"], sourceTransactionUuid: "jan", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
          { uuid: "salary", date: "2024-02-10", amount: 100, category: ["Income"], sourceTransactionUuid: "salary", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
          { uuid: "attributed", date: "2024-02-11", amount: -20, category: ["Expense"], sourceTransactionUuid: "attributed", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
          { uuid: "mar", date: "2024-03-10", amount: 1, category: ["Income"], sourceTransactionUuid: "mar", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        ] },
        { uuid: "partner", label: "Attributed", currency: "EUR", openingBalance: 0, transactions: [
          { uuid: "mirror", date: "2024-02-11", amount: 20, category: ["Expense"], sourceTransactionUuid: "mirror", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        ] },
      ],
    });
    const user = userEvent.setup();
    const renderScope = (scope: "realCashFlow" | "all" | "debtsOnly") => <CashFlowPageView {...createCashFlowPageModel(applyFilters(source, { ...createDefaultFilterState(), scope }), "month")} />;
    const view = render(renderScope("realCashFlow"));
    const summary = screen.getByText("Tendencia mensual");
    await user.click(summary);
    expect(screen.getByRole("heading", { name: "Tasa mensual de retención de efectivo" })).toBeVisible();
    expect(within(screen.getByRole("table", { name: "Detalle mensual de retención de efectivo" })).getByText(/80\s*%/)).toBeVisible();
    view.rerender(renderScope("all"));
    expect(screen.getByRole("heading", { name: "Tasa mensual de ahorro contable" })).toBeVisible();
    view.rerender(renderScope("debtsOnly"));
    const debtTable = screen.getByRole("table", { name: "Detalle mensual de variación de deudas" });
    expect(within(debtTable).getByRole("columnheader", { name: "Variación contable" })).toBeVisible();
    expect(within(debtTable).queryByText(/%|Sin base/)).toBeNull();
    expect(screen.getByText(/Los saldos contables no implican importes recuperables/)).toBeVisible();
    await user.click(summary);
    expect(screen.queryByRole("table", { name: "Detalle mensual de variación de deudas" })).toBeNull();
  });

  it("distinguishes signed real flow and shows active debt adjustments beside the composition", async () => {
    render(
      <CashFlowPageView
        trendFiltered={emptyTrendFiltered}
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
        trendFiltered={emptyTrendFiltered}
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
