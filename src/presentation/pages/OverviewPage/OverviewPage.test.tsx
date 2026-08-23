import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Compensados")).toBeVisible();
    expect(screen.getByText("Actualizando resultados…")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
