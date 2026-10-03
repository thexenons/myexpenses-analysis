import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { KpiSummary } from "../../../domain/analytics/types.ts";
import { OverviewPageView } from "./OverviewPage.view.tsx";
import { createOverviewPageModel } from "./OverviewPage.helpers.ts";
import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import * as csvHelpers from "../../components/organisms/ChartDataTable/ChartDataTable.helpers.ts";

const kpis: KpiSummary = {
  accountCount: 2,
  debtFlowEurMinor: 2_500,
  expenseRefundsEurMinor: 300,
  expensesEurMinor: -4_700,
  grossExpensesEurMinor: 5_000,
  grossIncomeEurMinor: 10_000,
  incomeReversalsEurMinor: 0,
  incomesEurMinor: 10_000,
  netEurMinor: 5_300,
  netExpensesEurMinor: -4_700,
  netIncomeEurMinor: 10_000,
  netTransfersEurMinor: 0,
  periodClosingBalanceEurMinor: 25_300,
  periodOpeningBalanceEurMinor: 20_000,
  postingCount: 3,
  realCashFlowEurMinor: 2_800,
  transferInflowsEurMinor: 0,
  transferOutflowsEurMinor: 0,
  transfersEurMinor: 0,
};

describe("OverviewPageView", () => {
  it("keeps the signed period result while omitting obsolete annulment copy", async () => {
    const user = userEvent.setup();
    render(
      <OverviewPageView
        accounts={[]}
        chartSeries={[]}
        debtAccountCount={1}
        debtBalanceEurMinor={2_500}
        expenseComposition={[{ amountEurMinor: 5_000, label: "Gasto bruto" }]}
        kpis={{ ...kpis, netEurMinor: -5_300, realCashFlowEurMinor: -7_800 }}
        searchPending={false}
        status={{
          CLEARED: { amountEurMinor: 0, count: 0 },
          RECONCILED: { amountEurMinor: 0, count: 1 },
          UNRECONCILED: { amountEurMinor: 0, count: 1 },
          VOID: { amountEurMinor: 0, count: 1 },
        }}
        topCategories={[]}
        valuationBalanceEurMinor={25_299}
      />,
    );

    const flow = screen.getByText("Flujo del periodo").closest("article");
    expect(flow).not.toBeNull();
    expect(within(flow!).getByText(/-53,00\s€/)).toBeVisible();
    expect(screen.getByText(/El flujo usa los apuntes filtrados; los saldos de apertura, cierre y deuda incluyen todo el historial/)).toBeVisible();
    expect(screen.queryByText(/apunte anulado visible/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pulso financiero" })).toBeVisible();
    const information = screen.getByText("Información del resumen");
    expect(information.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Pulso financiero" }).compareDocumentPosition(information) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    const details = screen.getByText("Saldos, deuda y conciliación");
    expect(details.closest("details")).not.toHaveAttribute("open");
    await user.click(details);
    expect(details.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Saldo en deudas")).toBeVisible();
    expect(screen.getByText("Apertura del periodo")).toBeVisible();
    expect(screen.queryByText("Anulados visibles")).not.toBeInTheDocument();
    expect(screen.getByText("Sin conciliar")).toBeVisible();
    expect(screen.getByText("3 apuntes")).toBeVisible();
    await user.click(screen.getByText("Composición y categorías"));
    expect(screen.getByRole("heading", { name: "Composición del gasto" })).toBeVisible();
    await user.click(information);
    expect(information.closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/Un neto negativo puede deberse a devoluciones o a asignaciones/)).toBeVisible();
    expect(screen.getByText(/Asignación en deudas: 0,00/)).toBeVisible();
  });

  it("renders the financial pulse and announces deferred filter updates", () => {
    render(
      <OverviewPageView
        accounts={[]}
        chartSeries={[]}
        debtAccountCount={1}
        debtBalanceEurMinor={2_500}
        expenseComposition={[
          { amountEurMinor: 5_000, label: "Gasto bruto" },
        ]}
        kpis={kpis}
        searchPending
        status={{
          CLEARED: { amountEurMinor: 0, count: 0 },
          RECONCILED: { amountEurMinor: 5_300, count: 3 },
          UNRECONCILED: { amountEurMinor: 0, count: 0 },
          VOID: { amountEurMinor: 0, count: 0 },
        }}
        topCategories={[]}
        valuationBalanceEurMinor={25_299}
      />,
    );

    expect(screen.getByText("Flujo del periodo")).toBeVisible();
    expect(screen.getByText("Pulso financiero")).toBeVisible();
    expect(screen.getByText("Compensados")).toBeInTheDocument();
    expect(screen.getByText("Actualizando resultados…")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});

it("switches filtered overview curves and exact CSV together without changing period KPIs", async () => {
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
  const model = createOverviewPageModel(applyFilters(source, filters), "day", false);
  const view = render(<OverviewPageView {...model} />);
  expect(screen.getByRole("radio", { name: "Por período" })).toBeChecked();
  const kpi = screen.getByText("Flujo del periodo").closest("article")!;
  const originalKpi = kpi.textContent;
  await user.click(screen.getByRole("radio", { name: "Acumulado" }));
  const figure = screen.getByRole("heading", { name: "Pulso financiero acumulado" }).closest("figure")!;
  expect(within(figure).getByText(/No incluye el saldo de apertura ni representa patrimonio/, { selector: "p" })).toBeVisible();
  await user.click(within(figure).getByText("Ver datos exactos"));
  const table = within(figure).getByRole("table");
  expect(within(table).getAllByRole("row").at(-1)).toHaveTextContent(/10,00\s*€.*-2,00\s*€.*8,00\s*€/);
  expect(within(table).getAllByRole("row")[2]).toHaveTextContent(/0,00\s*€.*-2,00\s*€.*-2,00\s*€/);
  const download = vi.spyOn(csvHelpers, "downloadChartCsv").mockImplementation(() => {});
  await user.click(within(figure).getByRole("button", { name: /Descargar CSV/ }));
  expect(download.mock.calls[0]![2].map((row) => row.values)).toEqual([[0, -2, -2], [0, -2, -2], [10, -2, 8]]);
  expect(kpi.textContent).toBe(originalKpi);
  const narrowed = applyFilters(source, { ...filters, categoryPrefixes: [["Income"]] });
  view.rerender(<OverviewPageView {...createOverviewPageModel(narrowed, "month", false)} />);
  expect(screen.getByRole("radio", { name: "Acumulado" })).toBeChecked();
  expect(within(screen.getByRole("table")).getAllByRole("row").at(-1)).toHaveTextContent(/10,00\s*€.*0,00\s*€.*10,00\s*€/);
  await user.click(screen.getByRole("radio", { name: "Por período" }));
  expect(screen.getByRole("heading", { name: "Pulso financiero" })).toBeVisible();
});

it("keeps period mode usable when cumulative overview arithmetic is unavailable", async () => {
  const model = createOverviewPageModel(applyFilters(normalizeDataset({ accounts: { version: 2, accounts: {} }, categories: {}, parsedData: [] }), createDefaultFilterState()), "day", false);
  render(<OverviewPageView {...model} {...{ cumulativeChartSeries: null }} />);
  await userEvent.setup().click(screen.getByRole("radio", { name: "Acumulado" }));
  expect(screen.getByRole("status")).toHaveTextContent("No se puede representar el acumulado de forma segura.");
  expect(screen.queryByRole("img", { name: /Pulso financiero/ })).toBeNull();
  await userEvent.setup().click(screen.getByRole("radio", { name: "Por período" }));
  expect(screen.getByRole("heading", { name: "Pulso financiero" })).toBeVisible();
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
  const model = createOverviewPageModel(filtered, "day", false);
  render(<OverviewPageView {...model} />);
  await user.click(screen.getByRole("radio", { name: "Acumulado" }));
  const figure = screen.getByRole("heading", { name: "Pulso financiero acumulado" }).closest("figure")!;
  await user.click(within(figure).getByText("Ver datos exactos"));
  const lastRow = within(within(figure).getByRole("table")).getAllByRole("row").at(-1)!;
  expect(lastRow).toHaveTextContent(/80\.000\.000\.000\.000,01\s*€/);
  const download = vi.spyOn(csvHelpers, "downloadChartCsv").mockImplementation(() => {});
  await user.click(within(figure).getByRole("button", { name: /Descargar CSV/ }));
  const [header, columns, rows] = download.mock.calls[0]!;
  expect(csvHelpers.createChartCsv(header, columns, rows).split("\r\n").at(-1)).toContain(",80000000000000.01");
});
