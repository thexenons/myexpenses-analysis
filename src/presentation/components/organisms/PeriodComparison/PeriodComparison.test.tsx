import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyFilters, createDefaultFilterState } from "../../../../domain/analytics/filters.ts";
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts";
import * as aggregations from "../../../../domain/analytics/aggregations.ts";
import type { PeriodComparisonProps } from "./PeriodComparison.types.ts";
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

afterEach(() => vi.restoreAllMocks());

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

  it("only renders the cumulative recorded-activity chart on expansion and updates its exact table", async () => {
    const user = userEvent.setup();
    render(<PeriodComparison filtered={fixture()} />);
    await user.click(screen.getByText("Comparar periodos"));
    await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod");
    const disclosure = screen.getByText("Actividad registrada acumulada", { selector: "summary" });
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByRole("img", { name: /Actividad registrada acumulada/ })).not.toBeInTheDocument();
    await user.click(screen.getByText("Actividad registrada acumulada", { selector: "summary" }));
    expect(screen.getByRole("img", { name: /Actividad registrada acumulada/ })).toBeVisible();
    expect(screen.getByText(/historial completo/)).toBeVisible();
    await user.click(screen.getByText("Ver datos exactos"));
    const exact = screen.getByRole("table", { name: "Datos exactos de Actividad registrada acumulada" });
    expect(within(exact).getByText("Día 31")).toBeVisible();
    expect(within(exact).getAllByText(/30,00/).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Estadística de la curva"), "income");
    expect(within(exact).queryByText(/30,00/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Comparar con"), "custom");
    expect(screen.queryByRole("img", { name: /Actividad registrada acumulada/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Referencia desde"), "2024-01-01");
    await user.type(screen.getByLabelText("Referencia hasta"), "2025-03-31");
    expect(screen.getByText("Actividad registrada acumulada", { selector: "summary" }).closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/hitos muestreados/)).toBeVisible();
    await user.click(screen.getByText("Actividad registrada acumulada", { selector: "summary" }));
    expect(screen.queryByRole("img", { name: /Actividad registrada acumulada/ })).not.toBeInTheDocument();
  });

  it("unmounts the expanded curve while the outer comparison is closed and refreshes it on reopening", async () => {
    const user = userEvent.setup();
    const initial = fixture();
    const { container, rerender } = render(<PeriodComparison filtered={initial} />);
    await user.click(screen.getByText("Comparar periodos", { selector: "summary" }));
    await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod");
    await user.click(screen.getByText("Actividad registrada acumulada", { selector: "summary" }));
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    await user.click(screen.getByText(/Comparar periodos/, { selector: "summary" }));
    expect(container.querySelector('svg[role="img"]')).toBeNull();
    expect(container.querySelector('option[value="expenses"]')).toBeNull();
    const filtered = applyFilters(initial.source, { ...initial.filters, categoryPrefixes: [["Sin coincidencias"]] });
    rerender(<PeriodComparison filtered={filtered} />);
    expect(container.querySelector('svg[role="img"]')).toBeNull();
    await user.click(screen.getByText(/Comparar periodos/, { selector: "summary" }));
    expect(screen.getByRole("img", { name: /Actividad registrada acumulada/ })).toBeVisible();
    expect(screen.getByText("Actividad registrada acumulada", { selector: "summary" }).closest("details")).toHaveAttribute("open");
    await user.click(screen.getByText("Ver datos exactos"));
    const table = screen.getByRole("table", { name: "Datos exactos de Actividad registrada acumulada" });
    const endpoint = within(table).getByRole("row", { name: /Día 31/ });
    expect(within(endpoint).getAllByRole("cell")[0]).toHaveTextContent("0,00");
  });
});


it("loads category contributions only on expansion and offers evidence for both periods", async () => {
  const user = userEvent.setup();
  const onViewCategory = vi.fn<NonNullable<PeriodComparisonProps["onViewCategory"]>>();
  const aggregate = vi.spyOn(aggregations, "aggregateCategoryBreakdown");
  const filtered = fixture();
  const view = render(<PeriodComparison filtered={filtered} onViewCategory={onViewCategory} />);
  await user.click(screen.getByText("Comparar periodos"));
  await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod");
  expect(aggregate).not.toHaveBeenCalled();
  const summary = screen.getByText("Contribuciones por categoría", { selector: "summary" });
  expect(summary.closest("details")).not.toHaveAttribute("open");
  expect(screen.queryByRole("region", { name: "Contribuciones por categoría" })).toBeNull();
  await user.click(summary);
  const detail = screen.getByRole("region", { name: "Contribuciones por categoría" });
  expect(aggregate).toHaveBeenCalledTimes(2);
  expect(within(detail).getByText("Sin apuntes")).toBeVisible();
  expect(detail).toHaveTextContent(/cambia el periodo global y recalcula/);
  await user.click(within(detail).getByRole("button", { name: "Ver apuntes actuales de Hogar" }));
  expect(onViewCategory).toHaveBeenCalledWith(expect.objectContaining({ dateRange: filtered.filters.dateRange, categoryPrefixes: [["Hogar"]] }));
  expect(within(detail).getByRole("button", { name: "Ver apuntes de referencia de Hogar" })).toBeDisabled();
  view.rerender(<PeriodComparison filtered={filtered} searchPending onViewCategory={onViewCategory} />);
  expect(within(detail).getByRole("button", { name: "Ver apuntes actuales de Hogar" })).toBeDisabled();
  await user.click(summary);
  aggregate.mockClear();
  view.rerender(<PeriodComparison filtered={{ ...filtered }} onViewCategory={onViewCategory} />);
  expect(aggregate).not.toHaveBeenCalled();
  aggregate.mockRestore();
});

it.each([{ categoryMode: "exclude" as const }, { categoryMatch: "either" as const }])("explains unrepresentable category intersections for both periods: %j", async (selection) => {
  const user = userEvent.setup();
  const filtered = fixture();
  render(<PeriodComparison filtered={{ ...filtered, filters: { ...filtered.filters, categoryPrefixes: [["Hogar"]], ...selection } }} onViewCategory={vi.fn<NonNullable<PeriodComparisonProps["onViewCategory"]>>()} />);
  await user.click(screen.getByText("Comparar periodos"));
  await user.selectOptions(screen.getByLabelText("Comparar con"), "previousPeriod");
  await user.click(screen.getByText("Contribuciones por categoría", { selector: "summary" }));
  const detail = screen.getByRole("region", { name: "Contribuciones por categoría" });
  expect(within(detail).getByText(/sin ampliar la selección/)).toBeVisible();
  expect(within(detail).getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
});
