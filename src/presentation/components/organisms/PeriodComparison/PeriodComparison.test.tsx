import { render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByText(/Referencia: 01 feb 2025 – 28 feb 2025/)).toBeVisible();
    expect(screen.getAllByText("Sin base")).toHaveLength(17);
    expect(screen.getByText(/Los ceros no garantizan/)).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Comparar con"), "none");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
