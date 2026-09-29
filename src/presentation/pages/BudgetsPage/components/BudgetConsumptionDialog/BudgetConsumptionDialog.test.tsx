import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BudgetContribution } from "../../../../../domain/analytics/budgets.ts";
import type { AnalyticsDataset, NormalizedAccount, NormalizedPosting } from "../../../../../domain/analytics/types.ts";
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

function account(id: string, label: string): NormalizedAccount {
  return {
    id, label, currency: "EUR", fractionDigits: 2, type: "DEFAULT", exchangeRateMode: "IDENTITY",
    openingBalanceNativeMinor: 0, openingBalanceEurMinor: 0, currentBalanceNativeMinor: 0,
    historicalBalanceEurMinor: 0, valuationBalanceEurMinor: 0, postingCount: 0, activePostingCount: 0,
  };
}

function datasetFor(postings: readonly NormalizedPosting[]): AnalyticsDataset {
  return {
    accounts: [account("account", "Cuenta"), account("other", "Destino")],
    currency: "EUR", minDate: "2026-08-03", maxDate: "2026-08-04", postings,
    source: { accounts: { version: 2, accounts: {} }, categories: {} },
  };
}

describe("BudgetConsumptionDialog", () => {
  it("keeps normalized status in closed details without changing signed amounts", async () => {
    installDialogStub();
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const statuses = ["RECONCILED", "CLEARED", "UNRECONCILED"] as const;
    const labels = ["Conciliada", "Compensada", "Sin conciliar"];
    const contributions = statuses.map((status, index) => {
      const entry = contribution(index);
      return Object.assign({}, entry, {
        amountMinor: index === 1 ? -25 : 100,
        posting: Object.assign({}, entry.posting, { status, backupStatus: "VOID" as const }),
      });
    });
    const { unmount } = render(
      <BudgetConsumptionDialog
        contributions={contributions}
        currency="EUR"
        dataset={datasetFor(contributions.map(({ posting }) => posting))}
        dateBasis="operation"
        fractionDigits={2}
        onDismiss={vi.fn<() => void>()}
        title="Gasto neto"
        trigger={trigger}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    for (const row of rows) expect(within(row).getByText(/Conciliada|Compensada|Sin conciliar/)).not.toBeVisible();
    await user.click(within(rows[0]!).getByText("Datos técnicos"));
    for (const [index, label] of labels.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- Each native details disclosure is checked after its own interaction.
      if (index > 0) await user.click(within(rows[index]!).getByText("Datos técnicos"));
      expect(within(rows[index]!).getByText(`${label} (${statuses[index]})`)).toBeVisible();
    }
    expect(within(rows[1]!).getByText("-0,25 €")).toBeVisible();
    expect(screen.getByText(/3 apuntes/)).toHaveTextContent("1,75 €");
    expect(screen.queryByText(/Anulada \(VOID\)/)).not.toBeInTheDocument();
    unmount();
    trigger.remove();
  });

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
        dataset={datasetFor([contribution(1).posting])}
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
        dataset={datasetFor([])}
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
        dataset={datasetFor(Array.from({ length: 27 }, (_, index) => contribution(index).posting))}
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
    expect(within(dialog).getAllByText("Sin comentario")).toHaveLength(25);
    expect(within(dialog).getAllByText(/Importe en cuenta/)).toHaveLength(25);
    for (const label of within(dialog).getAllByText(/Importe en cuenta/)) expect(label).not.toBeVisible();
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
        dataset={datasetFor([])}
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

  it("keeps payee, full comment, budget amount and transfer endpoints visible", async () => {
    installDialogStub();
    const user = userEvent.setup();
    const comment = "Long independent comment with identifying context ".repeat(3);
    const outgoing: NormalizedPosting = {
      ...contribution(0).posting, id: "outgoing", accountId: "account", accountLabel: "Cuenta",
      payee: "Payee only", comment, categoryPath: ["Gastos", "Comida"],
      linked: true, transferPeerPostingId: "incoming", amountNativeMinor: -200,
      status: "CLEARED", backupStatus: "VOID", paymentMethod: "Card", tags: ["Shared"],
      referenceNumber: "REF-1", splitIndex: 0, splitCount: 2,
      parent: { date: "2026-08-02", amount: -4, payee: "Parent payee", comment: "Parent comment" },
    };
    const incoming: NormalizedPosting = {
      ...contribution(1).posting, id: "incoming", accountId: "other", accountLabel: "Destino",
      linked: true, transferPeerPostingId: "outgoing", amountNativeMinor: 200,
    };
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const { unmount } = render(<BudgetConsumptionDialog
      contributions={[{ posting: outgoing, amountMinor: -125 }]}
      currency="EUR" dataset={datasetFor([outgoing, incoming])} dateBasis="value"
      fractionDigits={2} onDismiss={vi.fn<() => void>()} title="Gasto neto" trigger={trigger}
    />);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Payee only")).toBeVisible();
    expect(within(row).getByText(comment.trim())).toBeVisible();
    expect(within(row).getByText("04 ago 2026")).toBeVisible();
    expect(within(row).getByText("Gastos › Comida")).toBeVisible();
    expect(within(row).getByText("Cuenta", { selector: "dt" }).nextElementSibling).toHaveTextContent("Cuenta");
    expect(within(row).getByText("-1,25 €")).toBeVisible();
    expect(within(row).getByText("Origen", { selector: "dt" }).nextElementSibling).toHaveTextContent("Cuenta");
    expect(within(row).getByText("Destino", { selector: "dt" }).nextElementSibling).toHaveTextContent("Destino");
    expect(within(row).getByText("ID: outgoing")).not.toBeVisible();
    await user.click(within(row).getByText("Datos técnicos"));
    expect(within(row).getByText("Compensada (CLEARED)")).toBeVisible();
    expect(within(row).getByText(/-2,00.*US\$/u)).toBeVisible();
    expect(within(row).getByText("Parte de split").nextElementSibling).toHaveTextContent("1 de 2");
    expect(within(row).getByText("Card")).toBeVisible();
    expect(within(row).getByText("Shared")).toBeVisible();
    expect(within(row).getByText("REF-1")).toBeVisible();
    expect(within(row).getByText("Parent comment")).toBeVisible();
    unmount();
    trigger.remove();
  });

  it("resolves incoming and missing peers without guessing their counterpart account", async () => {
    installDialogStub();
    const user = userEvent.setup();
    const outgoing: NormalizedPosting = { ...contribution(0).posting, id: "outgoing", amountNativeMinor: -100, linked: true, transferPeerPostingId: "incoming" };
    const incoming: NormalizedPosting = { ...contribution(1).posting, id: "incoming", accountId: "other", accountLabel: "Destino", amountNativeMinor: 100, linked: true, transferPeerPostingId: "outgoing" };
    const missing: NormalizedPosting = { ...contribution(2).posting, id: "missing", amountNativeMinor: -100, linked: true, transferPeerPostingId: "not-present", transferAccount: "Do not infer" };
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const { unmount } = render(<BudgetConsumptionDialog
      contributions={[{ posting: incoming, amountMinor: 50 }, { posting: missing, amountMinor: -25 }]}
      currency="EUR" dataset={datasetFor([outgoing, incoming, missing])} dateBasis="operation"
      fractionDigits={2} onDismiss={vi.fn<() => void>()} title="Gasto neto" trigger={trigger}
    />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Origen", { selector: "dt" }).nextElementSibling).toHaveTextContent("Cuenta");
    expect(within(rows[0]!).getByText("Destino", { selector: "dt" }).nextElementSibling).toHaveTextContent("Destino");
    expect(within(rows[0]!).getByText("0,50 €")).toBeVisible();
    expect(within(rows[1]!).getByText("Origen", { selector: "dt" }).nextElementSibling).toHaveTextContent("Cuenta");
    expect(within(rows[1]!).getByText("Destino", { selector: "dt" }).nextElementSibling).toHaveTextContent("No verificada");
    expect(within(rows[1]!).queryByText("Do not infer")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText("-0,25 €")).toBeVisible();
    await user.click(within(rows[1]!).getByText("Datos técnicos"));
    expect(within(rows[1]!).getByText("ID: missing")).toBeVisible();
    unmount();
    trigger.remove();
  });
});
