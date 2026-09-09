import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DebtBreakdownItem } from "../../../domain/analytics/types.ts";
import { createDebtsPageModel, toggleDebtAccountIds } from "./DebtsPage.helpers.ts";
import { applyFilters, createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import type { AnalyticsDataset, NormalizedPosting } from "../../../domain/analytics/types.ts";
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
    expect(toggleDebtAccountIds([], debtIds, "one")).toEqual(["two"]);
    expect(toggleDebtAccountIds(["one"], debtIds, "two")).toEqual([
      "one",
      "two",
    ]);
    expect(toggleDebtAccountIds(["one"], debtIds, "one")).toEqual(["one"]);
    expect(toggleDebtAccountIds(["one", "two"], debtIds, "one")).toEqual(["two"]);
    expect(toggleDebtAccountIds(["cash"], debtIds, "two")).toEqual(["two"]);
  });

  it("keeps debt metrics visible and toggles the existing account filter", async () => {
    const user = userEvent.setup();
    const onClearAccounts = vi.fn<() => void>();
    const onToggleAccount = vi.fn<(accountId: string) => void>();
    const onViewTransactions = vi.fn<(accountId?: string) => void>();
    render(
      <DebtsPageView
        accountBars={[]}
        availableDebts={[debt]}
        debtSeries={[]}
        debts={[debt]}
        onClearAccounts={onClearAccounts}
        onToggleAccount={onToggleAccount}
        onViewTransactions={onViewTransactions}
        selectedAccountIds={new Set([debt.account.id, "other"])}
        showClearAccounts
        totals={{
          advancesEurMinor: 4_000,
          balanceEurMinor: 12_000,
          expensesEurMinor: 1_000,
          expenseRefundsEurMinor: 0,
          flowEurMinor: 1_500,
          recoveriesEurMinor: 2_500,
        }}
      />,
    );

    expect(screen.getByText("Saldo conjunto en deudas")).toBeVisible();
    expect(screen.getByText("Enviado a deudas")).toBeVisible();
    expect(screen.getByText("Recibido de deudas")).toBeVisible();
    expect(screen.getByText("Evolución de la selección")).toBeVisible();
    expect(screen.getByText("Seleccionar cuentas de deuda")).toBeVisible();

    const accountButton = screen.getByRole("button", {
      name: "Excluir Persona",
    });
    expect(accountButton).toHaveAttribute("aria-pressed", "true");
    await user.click(accountButton);
    expect(onToggleAccount).toHaveBeenCalledWith("debt");

    await user.click(screen.getByRole("button", { name: "Ver movimientos de Persona" }));
    expect(onViewTransactions).toHaveBeenCalledWith("debt");

    await user.click(screen.getByRole("button", { name: "Ver todas las deudas" }));
    expect(onClearAccounts).toHaveBeenCalledOnce();
  });

  it("keeps the actual balance series complete while filtering category movements", () => {
    const row = (id: string, amount: number, category: string): NormalizedPosting => ({
      accountId: "debt",
      accountLabel: "Persona",
      accountType: "DEBT",
      amountEurMinor: amount,
      amountNativeMinor: amount,
      bucket: "expense",
      categoryPath: [category],
      categoryType: "EXPENSE",
      currency: "EUR",
      date: "2024-01-15",
      exchangeRateSource: "identity",
      exchangeRateToEur: 1,
      fractionDigits: 2,
      id,
      isVoid: false,
      linked: false,
      sourceTransactionId: id,
      splitCount: null,
      splitIndex: null,
      status: "CLEARED",
      tags: [],
      transactionId: id,
    });
    const analytics: AnalyticsDataset = {
      accounts: [debt.account],
      currency: "EUR",
      minDate: "2024-01-15",
      maxDate: "2024-01-15",
      postings: [row("groceries", 500, "Supermercado"), row("other", 1_500, "Otros")],
      source: { accounts: { version: 2, accounts: {} }, categories: {} },
    };
    const filtered = applyFilters(analytics, {
      ...createDefaultFilterState(),
      categoryPrefixes: [["Supermercado"]],
    });
    const model = createDebtsPageModel(analytics, filtered, "month", new Set(["debt"]), vi.fn(), vi.fn(), vi.fn());
    expect(model.totals.flowEurMinor).toBe(500);
    expect(model.totals.balanceEurMinor).toBe(12_000);
    expect(model.debtSeries.find((series) => series.id === "debt-balance")?.data[0]?.value).toBe(120);
    expect(model.debtSeries.find((series) => series.id === "debt-flow")?.data[0]?.value).toBe(5);
  });

  it("shows opening debt as a constant balance even when only other accounts have activity", () => {
    const cash = { ...debt.account, id: "cash", type: "DEFAULT" as const, openingBalanceEurMinor: 0 };
    const row: NormalizedPosting = {
      accountId: "cash", accountLabel: "Caja", accountType: "DEFAULT", amountEurMinor: 100, amountNativeMinor: 100,
      bucket: "income", categoryPath: [], categoryType: "INCOME", currency: "EUR", date: "2024-01-01", exchangeRateSource: "identity", exchangeRateToEur: 1,
      fractionDigits: 2, id: "cash-in", isVoid: false, linked: false, sourceTransactionId: "cash-in", splitCount: null, splitIndex: null,
      status: "CLEARED", tags: [], transactionId: "cash-in",
    };
    const analytics: AnalyticsDataset = {
      accounts: [cash, debt.account], currency: "EUR", minDate: "2024-01-01", maxDate: "2024-03-01",
      postings: [row, { ...row, id: "cash-later", date: "2024-03-01" }],
      source: { accounts: { version: 2, accounts: {} }, categories: {} },
    };
    const filtered = applyFilters(analytics, { ...createDefaultFilterState(), scope: "debtsOnly" });
    const model = createDebtsPageModel(analytics, filtered, "month", new Set(["debt"]), vi.fn(), vi.fn(), vi.fn());
    expect(model.debtSeries.find((series) => series.id === "debt-balance")?.data.map((point) => point.value)).toEqual([100, 100, 100]);
  });
});
