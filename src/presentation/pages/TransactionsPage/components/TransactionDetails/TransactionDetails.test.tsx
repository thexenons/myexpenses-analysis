import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionDetails } from "./TransactionDetails.tsx";

describe("TransactionDetails", () => {
  it("exposes complete split provenance through a native disclosure", async () => {
    const user = userEvent.setup();
    const posting = {
      ...TRANSACTION_POSTING_FIXTURE,
      accountId: "account-usd",
      accountLabel: "Cuenta USD",
      amountEurMinor: -1_150,
      amountNativeMinor: -1_250,
      currency: "USD" as const,
      exchangeRateSource: "static" as const,
      exchangeRateToEur: 0.92,
      linked: true,
      parent: {
        amount: -25,
        comment: "Compra conjunta",
        date: "2026-08-20" as const,
        payee: "Tienda del padre",
        tags: ["Familia", "Revisar"],
      },
      sourceTransactionId: "parent-uuid",
      splitCount: 2,
      splitIndex: 0,
      tags: ["Trabajo", "Comida"],
      transactionId: "leaf-uuid",
      transferAccount: "Cuenta destino",
    };
    const { container } = render(<TransactionDetails posting={posting} />);
    const disclosure = container.querySelector("details");

    expect(disclosure).not.toHaveAttribute("open");
    await user.click(screen.getByText("Ver trazabilidad"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("leaf-uuid")).toBeVisible();
    expect(screen.getByText("parent-uuid")).toBeVisible();
    expect(screen.getByText("Parte 1 de 2")).toBeVisible();
    expect(screen.getByText("Gasto (EXPENSE)")).toBeVisible();
    expect(screen.getByText("Gasto (expense)")).toBeVisible();
    expect(screen.getByText(/1 USD = 0,92 EUR/)).toBeVisible();
    expect(screen.getByText("Sí · Cuenta destino")).toBeVisible();
    expect(screen.getByText("Trabajo · Comida")).toBeVisible();
    expect(screen.getByText("Tienda del padre")).toBeVisible();
    expect(screen.getByText("Compra conjunta")).toBeVisible();
    expect(screen.getByText("Familia · Revisar")).toBeVisible();
  });
});
