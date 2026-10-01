import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts";
import { PeriodComparison } from "./PeriodComparison.tsx";

function fixture() {
  const source = normalizeDataset({
    accounts: { version: 2, accounts: { cash: { label: "Banco", type: "DEFAULT" } } },
    categories: { Hogar: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "cash", label: "Banco", currency: "EUR", openingBalance: 0, transactions: [
      { uuid: "expense", sourceTransactionUuid: "expense", date: "2025-03-02", amount: -30, category: ["Hogar"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
    ] }],
  });
  return applyFilters(source, { ...createDefaultFilterState(), periodMode: "month", dateRange: { from: "2025-03-01", to: "2025-03-31" } });
}

describe("PeriodComparison", () => {
  it("lets the user compare without hiding dates or inventing percentages from a zero base", async () => {
    const user = userEvent.setup();
    render(<PeriodComparison filtered={fixture()} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByText("Comparar periodos"));
    await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod");
    const highlights = screen.getByRole("region", { name: "Indicadores destacados" });
    expect(within(highlights).getAllByRole("heading")).toHaveLength(3);
    expect(within(highlights).getByRole("heading", { name: "Ingreso neto seleccionado" })).toBeVisible();
    expect(within(highlights).getByRole("heading", { name: "Gasto neto seleccionado" })).toBeVisible();
    expect(within(highlights).getByRole("heading", { name: "Neto seleccionado" })).toBeVisible();
    expect(within(highlights).getAllByText("Sin base")).toHaveLength(3);
    expect(screen.getByText(/Referencia: 01 feb 2025 – 28 feb 2025/)).toBeVisible();
    expect(screen.getByText(/Los ceros no garantizan/)).toBeVisible();
    expect(screen.getByText(/No hay movimientos no anulados en la referencia/)).toBeVisible();
    expect(screen.getByText("Todas las estadísticas").closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByText("Todas las estadísticas"));
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(18);
    expect(screen.getAllByText("Sin base")).toHaveLength(20);
    await user.selectOptions(screen.getByLabelText("Comparar con"), "none");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps signed refunds and percentage semantics in the selected-metric highlights", async () => {
    const user = userEvent.setup();
    const source = normalizeDataset({
      accounts: { version: 2, accounts: { cash: { label: "Banco", type: "DEFAULT" } } },
      categories: { Hogar: { categoryType: "EXPENSE" } },
      parsedData: [{ uuid: "cash", label: "Banco", currency: "EUR", openingBalance: 0, transactions: [
        { uuid: "earlier", sourceTransactionUuid: "earlier", date: "2025-02-02", amount: -20, category: ["Hogar"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "expense", sourceTransactionUuid: "expense", date: "2025-03-02", amount: -30, category: ["Hogar"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
        { uuid: "refund", sourceTransactionUuid: "refund", date: "2025-03-03", amount: 40, category: ["Hogar"], sourceStatus: "RECONCILED", splitIndex: null, splitCount: null },
      ] }],
    });
    const filtered = applyFilters(source, { ...createDefaultFilterState(), periodMode: "month", dateRange: { from: "2025-03-01", to: "2025-03-31" } });
    render(<PeriodComparison filtered={filtered} />);
    await user.click(screen.getByText("Comparar periodos"));
    await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod");
    const highlights = screen.getByRole("region", { name: "Indicadores destacados" });
    const expense = within(highlights).getByRole("heading", { name: "Gasto neto seleccionado" }).closest("li")!;
    expect(within(expense).getByText(/^-10,00/)).toBeVisible();
    expect(within(expense).getByText(/^20,00/)).toBeVisible();
    expect(within(expense).getByText(/^-30,00/)).toBeVisible();
    expect(within(expense).getByText("-150 %")).toBeVisible();
    const net = within(highlights).getByRole("heading", { name: "Neto seleccionado" }).closest("li")!;
    expect(within(net).getByText(/^\+30,00/)).toBeVisible();
    expect(within(net).getByText("+150 %")).toBeVisible();
  });

  it("offers explicit independent reference dates and waits until both exist", async () => {
    const user = userEvent.setup();
    render(<PeriodComparison filtered={fixture()} />);
    await user.click(screen.getByText("Comparar periodos"));
    await user.selectOptions(screen.getByLabelText("Comparar con"), "custom");
    expect(screen.getByText("Completa las dos fechas de referencia.")).toBeVisible();
    expect(screen.getByLabelText("Referencia desde")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Referencia hasta")).toHaveAttribute("type", "date");
  });
});
