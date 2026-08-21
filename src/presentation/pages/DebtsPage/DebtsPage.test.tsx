import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebtsPageView } from "./DebtsPage.view.tsx";

describe("DebtsPageView", () => {
  it("keeps debt position, cash comparison and account detail visible", () => {
    render(
      <DebtsPageView
        accountBars={[]}
        debtSeries={[]}
        debts={[]}
        totals={{
          advancesEurMinor: 4_000,
          balanceEurMinor: 12_000,
          expensesEurMinor: 1_000,
          recoveriesEurMinor: 2_500,
        }}
      />,
    );

    expect(screen.getByText("Saldo conjunto en deudas")).toBeVisible();
    expect(screen.getByText("Nuevos adelantos")).toBeVisible();
    expect(screen.getByText("Deuda frente a caja")).toBeVisible();
    expect(screen.getByText("Detalle por cuenta")).toBeVisible();
  });
});
