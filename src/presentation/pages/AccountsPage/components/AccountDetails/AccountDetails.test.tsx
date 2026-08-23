import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AccountBreakdownItem } from "../../../../../domain/analytics/types.ts";
import { AccountDetails } from "./AccountDetails.tsx";

const item: AccountBreakdownItem = {
  account: {
    activePostingCount: 7,
    currency: "USD",
    currentBalanceNativeMinor: 25_000,
    exchangeRateMode: "STATIC",
    fractionDigits: 2,
    historicalBalanceEurMinor: 22_700,
    id: "cash-usd",
    label: "Cuenta USD",
    description: "Reserva operativa",
    excludedFromTotals: false,
    includedInAll: true,
    nativeType: "BANK",
    openingBalanceEurMinor: 18_400,
    openingBalanceNativeMinor: 20_000,
    postingCount: 9,
    type: "DEFAULT",
    supportsReconciliation: true,
    valuationBalanceEurMinor: 23_000,
    visible: false,
  },
  debtFlowEurMinor: 0,
  expensesEurMinor: -2_000,
  incomesEurMinor: 6_300,
  netEurMinor: 4_300,
  periodClosingBalanceEurMinor: 22_700,
  periodOpeningBalanceEurMinor: 18_400,
  postingCount: 7,
  realCashFlowEurMinor: 4_300,
  transfersEurMinor: 0,
};

describe("AccountDetails", () => {
  it("reveals native, historical, valuation and posting audit values", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AccountDetails exchangeRateToEur={0.92} item={item} />,
    );
    const disclosure = container.querySelector("details");

    expect(disclosure).not.toHaveAttribute("open");
    await user.click(screen.getByText("Detalles de Cuenta USD"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("200,00 US$")).toBeVisible();
    expect(screen.getByText("250,00 US$")).toBeVisible();
    expect(screen.getByText("227,00 €")).toBeVisible();
    expect(screen.getByText("230,00 €")).toBeVisible();
    expect(screen.getByText("Estática (STATIC)")).toBeVisible();
    expect(screen.getByText("Cuenta bancaria (BANK)")).toBeVisible();
    expect(screen.getByText("Oculta")).toBeVisible();
    expect(screen.getByText("Reserva operativa")).toBeVisible();
    expect(screen.getByText("1 USD = 0,92 EUR")).toBeVisible();
    expect(screen.getByText(/7 \/\s+9/)).toBeVisible();
  });
});
