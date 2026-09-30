import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { KpiSummary } from "../../../domain/analytics/types.ts";
import { OverviewPageView } from "./OverviewPage.view.tsx";

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
