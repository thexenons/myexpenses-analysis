import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DebtBreakdownItem } from "../../../domain/analytics/types.ts";
import { toggleDebtAccountIds } from "./DebtsPage.helpers.ts";
import { DebtsPageView } from "./DebtsPage.view.tsx";

const debt: DebtBreakdownItem = {
  account: {
    activePostingCount: 1,
    currency: "EUR",
    currentBalanceNativeMinor: 12_000,
    exchangeRateMode: "IDENTITY",
    fractionDigits: 2,
    historicalBalanceEurMinor: 12_000,
    id: "debt",
    label: "Persona",
    openingBalanceEurMinor: 10_000,
    openingBalanceNativeMinor: 10_000,
    postingCount: 1,
    type: "DEBT",
    valuationBalanceEurMinor: 12_000,
  },
  advancesEurMinor: 0,
  debtExpenseRefundsEurMinor: 0,
  debtFlowEurMinor: 2_000,
  expensesEurMinor: 0,
  grossDebtExpensesEurMinor: 0,
  incomesEurMinor: 2_000,
  netEurMinor: 2_000,
  periodClosingBalanceEurMinor: 12_000,
  periodOpeningBalanceEurMinor: 10_000,
  postingCount: 1,
  realCashFlowEurMinor: 0,
  recoveriesEurMinor: 2_000,
  transfersEurMinor: 0,
};

describe("DebtsPageView", () => {
  it("combines and clears debt ids through the global account selection", () => {
    const debtIds = new Set(["one", "two"]);
    expect(toggleDebtAccountIds([], debtIds, "one")).toEqual(["one"]);
    expect(toggleDebtAccountIds(["one"], debtIds, "two")).toEqual([
      "one",
      "two",
    ]);
    expect(toggleDebtAccountIds(["one"], debtIds, "one")).toEqual([]);
    expect(toggleDebtAccountIds(["cash"], debtIds, "two")).toEqual(["two"]);
  });

  it("keeps debt metrics visible and toggles the existing account filter", async () => {
    const user = userEvent.setup();
    const onClearAccounts = vi.fn<() => void>();
    const onToggleAccount = vi.fn<(accountId: string) => void>();
    render(
      <DebtsPageView
        accountBars={[]}
        availableDebts={[debt]}
        debtSeries={[]}
        debts={[debt]}
        onClearAccounts={onClearAccounts}
        onToggleAccount={onToggleAccount}
        selectedAccountIds={new Set([debt.account.id])}
        showClearAccounts
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
    expect(screen.getByText("Evolución de la selección")).toBeVisible();
    expect(screen.getByText("Seleccionar cuentas de deuda")).toBeVisible();

    const accountButton = screen.getByRole("button", {
      name: "Quitar filtro de Persona",
    });
    expect(accountButton).toHaveAttribute("aria-pressed", "true");
    await user.click(accountButton);
    expect(onToggleAccount).toHaveBeenCalledWith("debt");

    await user.click(screen.getByRole("button", { name: "Ver todas las deudas" }));
    expect(onClearAccounts).toHaveBeenCalledOnce();
  });
});
