import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AccountBreakdownItem } from "../../../domain/analytics/types.ts";
import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../domain/analytics/normalize.ts";
import { createAccountsPageModel } from "./AccountsPage.helpers.ts";
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
  it("carries every balance over one common range, including accounts without postings", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: {
        cash: { label: "Cuenta", type: "DEFAULT" },
        reserve: { label: "Reserva", type: "DEFAULT" },
      } },
      categories: { Gastos: { categoryType: "EXPENSE" } },
      parsedData: [
        { uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 100, transactions: [
          { uuid: "jan", date: "2026-01-01", amount: -20, category: ["Gastos"], sourceTransactionUuid: "jan", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
          { uuid: "mar", date: "2026-03-02", amount: -10, category: ["Gastos"], sourceTransactionUuid: "mar", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        ] },
        { uuid: "reserve", label: "Reserva", currency: "EUR", openingBalance: 50, transactions: [] },
      ],
    });
    const model = createAccountsPageModel(applyFilters(analytics, createDefaultFilterState()), vi.fn());
    for (const series of model.accountSeries ?? []) {
      expect(series.color).toBe(model.accountBars.find((bar) => bar.id === series.id)?.color);
    }
    expect(model.accountSeries?.find((series) => series.id === "reserve")?.data.map(({ value }) => value)).toEqual([50, 50, 50]);
    expect(model.accountSeries?.find((series) => series.id === "cash")?.data.map(({ value }) => value)).toEqual([80, 80, 70]);
    const future = createAccountsPageModel(applyFilters(analytics, {
      ...createDefaultFilterState(), dateRange: { from: "2027-01-01", to: null },
    }), vi.fn());
    expect(future.accountSeries?.find((series) => series.id === "cash")?.data).toEqual([{ label: "2027-01", value: 70 }]);
  });

  it("separates real closing balances from filtered expenses in comparison charts", () => {
    const analytics = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Cuenta", type: "DEFAULT" } } },
      categories: { Casa: { categoryType: "EXPENSE" }, Comida: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Cuenta", currency: "EUR", openingBalance: 100, transactions: [
        { uuid: "home", date: "2026-01-01", amount: -20, category: ["Casa"], sourceTransactionUuid: "home", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "food", date: "2026-01-02", amount: -10, category: ["Comida"], sourceTransactionUuid: "food", sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), categoryPrefixes: [["Comida"]] });
    const balances = createAccountsPageModel(filtered, vi.fn());
    expect(balances.accountBars[0]?.value).toBe(70);
    expect(balances.accountSeries?.[0]?.data[0]?.value).toBe(70);
    expect(balances.totals.flowEurMinor).toBe(-1_000);
    const expenses = createAccountsPageModel(filtered, vi.fn(), "expensesEurMinor");
    expect(expenses.accountBars[0]?.value).toBe(-10);
    expect(expenses.accountSeries?.[0]?.data[0]?.value).toBe(-10);
  });

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
