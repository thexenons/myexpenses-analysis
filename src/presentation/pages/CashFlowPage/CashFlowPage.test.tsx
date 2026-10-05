import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import type { AppDataset, KpiSummary } from "../../../domain/analytics/types.ts";
import { createCashFlowPageModel } from "./CashFlowPage.helpers.ts";
import { CashFlowPageView } from "./CashFlowPage.view.tsx";
import { MonthlySavingsTrend } from "./CashFlowPage.savings-trend.tsx";
import * as csvHelpers from "../../components/organisms/ChartDataTable/ChartDataTable.helpers.ts";

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

it("refreshes monthly savings completeness across midnight without changing the dataset", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-31T22:59:30Z"));
  const source = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: { Income: { categoryType: "INCOME" }, Expense: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "income", date: "2026-01-01", amount: 100, category: ["Income"], sourceTransactionUuid: "income", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      { uuid: "expense", date: "2026-01-31", amount: -50, category: ["Expense"], sourceTransactionUuid: "expense", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
    ] }],
  });
  const filtered = applyFilters(source, createDefaultFilterState());
  const view = render(<MonthlySavingsTrend filtered={filtered} />);
  try {
    expect(screen.queryByRole("table", { name: "Detalle mensual del ahorro contable" })).toBeNull();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("table", { name: "Detalle mensual del ahorro contable" })).toBeVisible();
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

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

it("switches cash-flow lines and exact CSV together while leaving bars and monthly trend unchanged", async () => {
  const user = userEvent.setup();
  const source = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: { Expense: { categoryType: "EXPENSE" }, Income: { categoryType: "INCOME" } },
    parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 100, transactions: [
      { uuid: "expense", date: "2026-01-01", amount: -2, category: ["Expense"], sourceTransactionUuid: "expense", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "income", date: "2026-01-03", amount: 10, category: ["Income"], sourceTransactionUuid: "income", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    ] }],
  });
  const filters = { ...createDefaultFilterState(), dateRange: { from: "2026-01-01", to: "2026-01-03" } } as const;
  const model = createCashFlowPageModel(applyFilters(source, filters), "day");
  const view = render(<CashFlowPageView {...model} />);
  expect(screen.getByRole("radio", { name: "Por período" })).toBeChecked();
  const bars = screen.getByRole("heading", { name: "Tensión entre entradas y salidas" }).closest("figure")!;
  const originalBars = bars.innerHTML;
  const originalKpi = screen.getByRole("article", { name: "Flujo real" }).textContent;
  await user.click(screen.getByRole("radio", { name: "Acumulado" }));
  const figure = screen.getByRole("heading", { name: "Flujo neto acumulado" }).closest("figure")!;
  expect(within(figure).getByText(/No incluye el saldo de apertura ni representa patrimonio/, { selector: "p" })).toBeVisible();
  await user.click(within(figure).getByText("Ver datos exactos"));
  const table = within(figure).getByRole("table");
  expect(within(table).getAllByRole("row").at(-1)).toHaveTextContent(/8,00\s*€.*8,00\s*€/);
  expect(within(table).getAllByRole("row")[2]).toHaveTextContent(/-2,00\s*€.*-2,00\s*€/);
  const download = vi.spyOn(csvHelpers, "downloadChartCsv").mockImplementation(() => {});
  await user.click(within(figure).getByRole("button", { name: /Descargar CSV/ }));
  expect(download.mock.calls[0]![2].map((row) => row.values)).toEqual([[-2, -2], [-2, -2], [8, 8]]);
  expect(bars.innerHTML).toBe(originalBars);
  expect(screen.getByRole("article", { name: "Flujo real" }).textContent).toBe(originalKpi);
  expect(screen.getByText("Tendencia mensual").closest("details")).not.toHaveAttribute("open");
  const later = applyFilters(source, { ...filters, dateRange: { from: "2026-01-02", to: "2026-01-03" } });
  view.rerender(<CashFlowPageView {...createCashFlowPageModel(later, "day")} />);
  expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent(/0,00\s*€.*0,00\s*€/);
  expect(within(screen.getByRole("table")).getAllByRole("row").at(-1)).toHaveTextContent(/10,00\s*€.*10,00\s*€/);
  await user.click(screen.getByRole("radio", { name: "Por período" }));
  expect(screen.getByRole("heading", { name: "Flujo neto por periodo" })).toBeVisible();
});

it("reports an unavailable cumulative cash-flow curve without replacing period bars", async () => {
  render(<CashFlowPageView {...createCashFlowPageModel(emptyTrendFiltered, "day")} {...{ cumulativeLineSeries: null }} />);
  await userEvent.setup().click(screen.getByRole("radio", { name: "Acumulado" }));
  expect(screen.getByRole("status")).toHaveTextContent("No se puede representar el acumulado de forma segura.");
  expect(screen.getByRole("heading", { name: "Tensión entre entradas y salidas" })).toBeVisible();
  expect(screen.queryByRole("img", { name: /Flujo neto/ })).toBeNull();
});


it("preserves safe accumulated minor units in the exact table and CSV at the decimal precision boundary", async () => {
  const user = userEvent.setup();
  const source = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Cash", type: "DEFAULT" } } },
    categories: { Income: { categoryType: "INCOME" } },
    parsedData: [{ uuid: "cash", label: "Cash", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "first", date: "2026-01-01", amount: 40000000000000, category: ["Income"], sourceTransactionUuid: "first", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
      { uuid: "second", date: "2026-01-02", amount: 40000000000000.01, category: ["Income"], sourceTransactionUuid: "second", sourceStatus: "CLEARED", splitIndex: null, splitCount: null },
    ] }],
  });
  const filtered = applyFilters(source, createDefaultFilterState());
  expect(filtered.activePostings.map((point) => point.amountEurMinor)).toEqual([4000000000000000, 4000000000000001]);
  const model = createCashFlowPageModel(filtered, "day");
  render(<CashFlowPageView {...model} />);
  await user.click(screen.getByRole("radio", { name: "Acumulado" }));
  const figure = screen.getByRole("heading", { name: "Flujo neto acumulado" }).closest("figure")!;
  await user.click(within(figure).getByText("Ver datos exactos"));
  const lastRow = within(within(figure).getByRole("table")).getAllByRole("row").at(-1)!;
  expect(lastRow).toHaveTextContent(/80\.000\.000\.000\.000,01\s*€/);
  const download = vi.spyOn(csvHelpers, "downloadChartCsv").mockImplementation(() => {});
  await user.click(within(figure).getByRole("button", { name: /Descargar CSV/ }));
  const [header, columns, rows] = download.mock.calls[0]!;
  expect(csvHelpers.createChartCsv(header, columns, rows).split("\r\n").at(-1)).toContain(",80000000000000.01");
});
