import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BudgetContribution } from "../../../../../domain/analytics/budgets.ts";
import type { NormalizedPosting } from "../../../../../domain/analytics/types.ts";
import { BudgetConsumptionDialog } from "./BudgetConsumptionDialog.tsx";

function installDialogStub() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = false; },
  });
}

function contribution(index: number): BudgetContribution {
  return {
    posting: {
      id: `posting-${index}`,
      transactionId: `posting-${index}`,
      sourceTransactionId: `posting-${index}`,
      accountId: "account",
      date: "2026-08-03",
      valueDate: "2026-08-04",
      categoryPath: ["Gastos"],
      categoryType: "EXPENSE",
      bucket: "expense",
      accountLabel: "Cuenta",
      accountType: "DEFAULT",
      currency: "USD",
      fractionDigits: 2,
      amountNativeMinor: -100,
      amountEurMinor: -100,
      exchangeRateToEur: 1,
      exchangeRateSource: "dynamic-equivalent",
      status: "RECONCILED",
      isVoid: false,
      linked: false,
      tags: [],
      splitIndex: null,
      splitCount: null,
    } satisfies NormalizedPosting,
    amountMinor: 100,
  };
}

describe("BudgetConsumptionDialog", () => {
  it("ignores a delayed close event from StrictMode effect replay", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
        setTimeout(() => this.dispatchEvent(new Event("close")), 0);
      },
    });
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const onDismiss = vi.fn<() => void>();
    const { unmount } = render(
      <StrictMode>
        <BudgetConsumptionDialog
          contributions={[contribution(1)]}
          currency="EUR"
          dateBasis="operation"
          fractionDigits={2}
          onDismiss={onDismiss}
          title="Gasto neto"
          trigger={trigger}
        />
      </StrictMode>,
    );
    await waitFor(() => expect(onDismiss).not.toHaveBeenCalled(), { timeout: 50 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("dialog", { name: "Gasto neto · apuntes" })).toBeVisible();
    expect(onDismiss).not.toHaveBeenCalled();
    unmount();
    trigger.remove();
  });

  it("dismisses a genuine native close event", () => {
    installDialogStub();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const onDismiss = vi.fn<() => void>();
    const { unmount } = render(
      <BudgetConsumptionDialog
        contributions={[]}
        currency="EUR"
        dateBasis="operation"
        fractionDigits={2}
        onDismiss={onDismiss}
        title="Gasto neto"
        trigger={trigger}
      />,
    );
    const dialog = screen.getByRole("dialog");
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
    expect(onDismiss).toHaveBeenCalledOnce();
    unmount();
    trigger.remove();
  });

  it("paginates a large exact set and shows budget and original currency", async () => {
    installDialogStub();
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const { unmount } = render(
      <BudgetConsumptionDialog
        contributions={Array.from({ length: 27 }, (_, index) => contribution(index))}
        currency="EUR"
        dateBasis="value"
        fractionDigits={2}
        onDismiss={vi.fn<() => void>()}
        title="Gasto neto"
        trigger={trigger}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Gasto neto · apuntes" });
    const scrollRegion = within(dialog).getByRole("region", { name: "Gasto neto · apuntes" });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(25);
    expect(within(dialog).getByText(/27 apuntes/)).toHaveTextContent("27,00");
    expect(within(dialog).getAllByText(/Original:/)).toHaveLength(25);
    expect(within(dialog).getAllByText(/04 ago 2026/)).toHaveLength(25);
    expect(screen.getByRole("button", { name: "Cerrar detalle" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Mostrar más/ }));
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(27);
    expect(screen.queryByRole("button", { name: /Mostrar más/ })).not.toBeInTheDocument();
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(dialog);
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("explains a zero-consumption selection without inventing movements", () => {
    installDialogStub();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const { unmount } = render(
      <BudgetConsumptionDialog
        contributions={[]}
        currency="EUR"
        dateBasis="operation"
        fractionDigits={2}
        onDismiss={vi.fn<() => void>()}
        title="Gastos"
        trigger={trigger}
      />,
    );
    expect(screen.getByText("No hay apuntes para este consumo.")).toBeVisible();
    expect(screen.getByText(/0 apuntes/)).toHaveTextContent("0,00");
    unmount();
    trigger.remove();
  });
});
