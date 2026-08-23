import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AccountBreakdownItem } from "../../../domain/analytics/types.ts";
import { AccountsPageView } from "./AccountsPage.view.tsx";

const account: AccountBreakdownItem = {
  account: {
    activePostingCount: 3,
    currency: "EUR",
    currentBalanceNativeMinor: 25_000,
    exchangeRateMode: "IDENTITY",
    fractionDigits: 2,
    historicalBalanceEurMinor: 25_000,
    id: "cash",
    label: "Cuenta diaria",
    openingBalanceEurMinor: 20_000,
    openingBalanceNativeMinor: 20_000,
    postingCount: 3,
    type: "DEFAULT",
    valuationBalanceEurMinor: 25_000,
  },
  debtFlowEurMinor: 0,
  expensesEurMinor: -2_000,
  incomesEurMinor: 7_000,
  netEurMinor: 5_000,
  periodClosingBalanceEurMinor: 25_000,
  periodOpeningBalanceEurMinor: 20_000,
  postingCount: 3,
  realCashFlowEurMinor: 5_000,
  transfersEurMinor: 0,
};

describe("AccountsPageView", () => {
  it("turns an account card into a global account-filter action", async () => {
    const user = userEvent.setup();
    const onSelectAccount = vi.fn<(accountId: string) => void>();
    render(
      <AccountsPageView
        accountBars={[]}
        accounts={[{ ...account, exchangeRateToEur: 1 }]}
        onSelectAccount={onSelectAccount}
        totals={{
          closingEurMinor: 25_000,
          debtCount: 0,
          flowEurMinor: 5_000,
          postingCount: 3,
        }}
      />,
    );

    const filterButton = screen.getByRole("button", {
      name: "Filtrar por Cuenta diaria",
    });
    const card = screen.getByRole("article", { name: "Cuenta Cuenta diaria" });
    const disclosure = card.querySelector("details");

    expect(card).toContainElement(filterButton);
    expect(filterButton).not.toContainElement(disclosure);
    await user.click(filterButton);
    expect(onSelectAccount).toHaveBeenCalledWith("cash");
    expect(screen.getByText("Mapa de saldos")).toBeVisible();
  });
});
