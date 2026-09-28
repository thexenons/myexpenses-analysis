import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionDetails } from "./TransactionDetails.tsx";

describe("TransactionDetails", () => {
  it("reveals full current posting text separately from split parent text by keyboard", async () => {
    const user = userEvent.setup();
    const payee = "Current posting payee with a deliberately long identifying suffix 123456789";
    const comment = "Current posting comment with complete details that cannot fit a compact row 987654321";
    render(<TransactionDetails posting={{
      ...TRANSACTION_POSTING_FIXTURE,
      payee,
      comment,
      parent: { amount: -12.5, date: "2026-08-20", payee: "Parent payee", comment: "Parent comment" },
      splitCount: 2,
      splitIndex: 0,
    }} />);

    const summary = screen.getByText("Ver concepto completo y trazabilidad");
    summary.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Payee del apunte").nextElementSibling).toHaveTextContent(payee);
    expect(screen.getByText("Comentario del apunte").nextElementSibling).toHaveTextContent(comment);
    expect(screen.getByText("Payee del padre").nextElementSibling).toHaveTextContent("Parent payee");
    expect(screen.getByText("Comentario del padre").nextElementSibling).toHaveTextContent("Parent comment");
    await user.keyboard(" ");
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });

  it("shows a missing conversion rate without inventing a zero or identity rate", async () => {
    const user = userEvent.setup();
    render(<TransactionDetails posting={{ ...TRANSACTION_POSTING_FIXTURE, currency: "JPY", exchangeRateToEur: null, exchangeRateSource: "unavailable", amountEurMinor: 0, amountNativeMinor: 0, categoryPath: [] }} />);
    await user.click(screen.getByText("Ver concepto completo y trazabilidad"));
    expect(screen.getByText("Tasa aplicada").nextElementSibling).toHaveTextContent("No disponible");
    expect(screen.getByText("Fuente de la tasa").nextElementSibling).toHaveTextContent("Importe cero sin tasa (unavailable)");
    expect(screen.getByText("Sin categoría")).toBeVisible();
    expect(screen.queryByText(/1 JPY =/)).not.toBeInTheDocument();
  });

  it("exposes complete split provenance through a native disclosure", async () => {
    const user = userEvent.setup();
    const posting = {
      ...TRANSACTION_POSTING_FIXTURE,
      accountId: "account-usd",
      accountLabel: "Cuenta USD",
      amountEurMinor: -1_150,
      amountNativeMinor: -1_250,
      backupStatus: "CLEARED" as const,
      currency: "USD" as const,
      exchangeRateSource: "static" as const,
      exchangeRateToEur: 0.92,
      linked: true,
      localTime: "19:42:03",
      paymentMethod: "Tarjeta",
      parent: {
        amount: -25,
        amountNativeMinor: -2_500,
        comment: "Compra conjunta",
        date: "2026-08-20" as const,
        localTime: "19:40:00",
        payee: "Tienda del padre",
        paymentMethod: "Método padre",
        tags: ["Familia", "Revisar"],
      },
      referenceNumber: "REF-42",
      sourceRowId: 42,
      sourceTransactionId: "parent-uuid",
      splitCount: 2,
      splitIndex: 0,
      tags: ["Trabajo", "Comida"],
      transactionId: "leaf-uuid",
      transferAccount: "Cuenta destino",
      valueDate: "2026-08-21" as const,
      valueTime: "00:00:00",
    };
    const { container } = render(<TransactionDetails posting={posting} />);
    const disclosure = container.querySelector("details");

    expect(disclosure).not.toHaveAttribute("open");
    await user.click(screen.getByText("Ver concepto completo y trazabilidad"));
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
    expect(screen.getByText(/21 ago 2026 · 00:00:00/i)).toBeVisible();
    expect(screen.getByText("Compensada (CLEARED)")).toBeVisible();
    expect(screen.getByText("Tarjeta")).toBeVisible();
    expect(screen.getByText("REF-42")).toBeVisible();
    expect(screen.getByText("Método padre")).toBeVisible();
    expect(screen.getByText("Compra conjunta")).toBeVisible();
    expect(screen.getByText("Familia · Revisar")).toBeVisible();
  });
});
