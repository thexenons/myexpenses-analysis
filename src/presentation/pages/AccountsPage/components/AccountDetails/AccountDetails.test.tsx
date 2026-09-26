import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AccountBreakdownItem } from "../../../../../domain/analytics/types.ts";
import { AccountDetails } from "./AccountDetails.tsx";
import { formatAccountExchangeRate, resolveAccountExchangeRate } from "./AccountDetails.helpers.ts";

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
  it.each([
    { currency: "JPY" as const, fractionDigits: 0, currentBalanceNativeMinor: 1_000, valuationBalanceEurMinor: 600, expected: 0.006 },
    { currency: "KWD" as const, fractionDigits: 3, currentBalanceNativeMinor: 1_000, valuationBalanceEurMinor: 300, expected: 3 },
  ])("derives the dynamic EUR rate in major units for $currency", ({ expected, ...currency }) => {
    expect(resolveAccountExchangeRate({ ...item.account, ...currency, exchangeRateMode: "DYNAMIC" }, undefined)).toBeCloseTo(expected);
  });

  it("does not infer a zero exchange rate from a rounded zero valuation", () => {
    expect(resolveAccountExchangeRate({ ...item.account, exchangeRateMode: "DYNAMIC", valuationBalanceEurMinor: 0 }, undefined)).toBeNull();
    expect(formatAccountExchangeRate("USD", null)).toBe("No disponible");
  });

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
    expect(screen.getByText("Incluida en los totales de MyExpenses").nextElementSibling).toHaveTextContent("Sí");
    expect(screen.getByText("Reserva operativa")).toBeVisible();
    expect(screen.getByText("1 USD = 0,92 EUR")).toBeVisible();
    expect(screen.getByText(/7 \/\s+9/)).toBeVisible();
  });
});
