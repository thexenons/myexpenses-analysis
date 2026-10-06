import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AnnualProjectionResult } from "../../../../../domain/analytics/annual-projection.ts";
import type { IsoDate } from "../../../../../domain/analytics/types.ts";
import { AnnualProjection } from "./index.ts";

describe("AnnualProjection", () => {
  it("keeps unsupported data distinct from calculation errors", () => {
    const { rerender } = render(<AnnualProjection error={null} result={{ status: "unavailable", reason: "incompatible-currency" }} />);
    const panel = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    expect(panel).toHaveTextContent("moneda del presupuesto");
    expect(within(panel).queryByRole("img")).not.toBeInTheDocument();
    rerender(<AnnualProjection error="calculation-error" result={null} />);
    expect(panel).toHaveTextContent("No se ha podido calcular");
  });

  it("shows an annual budget's exact even distribution assumption", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      key: `2026-${String(index + 1).padStart(2, "0")}`, month: index + 1,
      startDate: `2026-${String(index + 1).padStart(2, "0")}-01` as IsoDate,
      endDate: `2026-${String(index + 1).padStart(2, "0")}-28` as IsoDate,
      kind: "actual" as const, incomeMinor: 0, observedIncomeEurMinor: 0,
      budgetMinor: index === 0 ? 101 : 100, monthlyContributionEurMinor: 0, cumulativeEurMinor: 0,
    }));
    const projection = {
      status: "ready", year: 2026, currency: "EUR", fractionDigits: 2,
      dateScope: "full-budget-calendar-year", dateBasis: "operation",
      coverage: { from: "2026-01-01", to: "2026-12-31" },
      income: { basis: "same-year-complete-month-mean", completeMonthCount: 12,
        completeMonthKeys: points.map((point) => point.key), totalMinor: 0, expectedMonthlyMinor: null },
      budget: { grouping: "YEAR", distribution: "even-calendar-months", annualBudgetMinor: 1_201 },
      points,
    } satisfies AnnualProjectionResult;
    render(<AnnualProjection error={null} result={projection} />);
    const panel = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    expect(panel).toHaveTextContent("Diciembre: 0,00");
    expect(panel).toHaveTextContent("Flujo neto real acumulado desde enero");
    expect(panel).toHaveTextContent("ni saldo actual ni dinero disponible");
    expect(panel).not.toHaveTextContent("Escenario condicionado al presupuesto");
    expect(panel).not.toHaveTextContent("El gasto observado en esos meses no modifica el aporte");
    expect(panel).toHaveTextContent("12 meses cerrados dentro del intervalo observado");
    expect(within(panel).getByText("Cobertura no verificada.")).toBeVisible();
    expect(panel).toHaveTextContent("Las fechas observadas no garantizan un historial completo");
    expect(panel).not.toHaveTextContent("meses completos");
    expect(panel).not.toHaveTextContent("cobertura completa");
    expect(panel).toHaveTextContent("12 meses naturales");
    expect(panel).toHaveTextContent("flujo real y los ingresos son globales");
    expect(panel).toHaveTextContent("restricciones de cuentas o categorías del presupuesto");
    expect(panel).toHaveTextContent("asignación completa del presupuesto seleccionado");
    expect(panel).toHaveTextContent("céntimos restantes");
    expect(within(panel).getByRole("img", { name: "Ahorro acumulado en 2026" })).toBeVisible();
  });
  it("explains estimated contributions before the chart without changing the exact amounts", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      key: `2026-${String(index + 1).padStart(2, "0")}`, month: index + 1,
      startDate: `2026-${String(index + 1).padStart(2, "0")}-01` as IsoDate,
      endDate: `2026-${String(index + 1).padStart(2, "0")}-28` as IsoDate,
      kind: index === 0 ? "actual" as const : "estimated" as const,
      incomeMinor: 1_000, observedIncomeEurMinor: index === 0 ? 1_000 : 0,
      budgetMinor: 600, monthlyContributionEurMinor: index === 0 ? 200 : 400,
      cumulativeEurMinor: 200 + index * 400,
    }));
    const projection = {
      status: "ready", year: 2026, currency: "EUR", fractionDigits: 2,
      dateScope: "full-budget-calendar-year", dateBasis: "operation",
      coverage: { from: "2026-01-01", to: "2026-01-31" },
      income: { basis: "same-year-complete-month-mean", completeMonthCount: 1,
        completeMonthKeys: ["2026-01"], totalMinor: 1_000, expectedMonthlyMinor: 1_000 },
      budget: { grouping: "MONTH", distribution: "per-calendar-month-label", annualBudgetMinor: 7_200 },
      points,
    } satisfies AnnualProjectionResult;
    render(<AnnualProjection error={null} result={projection} />);
    const panel = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    const note = within(panel).getByText("Escenario condicionado al presupuesto.").closest("p")!;
    expect(note).toBeVisible();
    expect(note).toHaveTextContent("ingresos previstos menos la asignación mensual completa");
    expect(note).toHaveTextContent("El gasto observado en esos meses no modifica el aporte");
    expect(note).toHaveTextContent("Los meses cerrados del intervalo observado usan el flujo registrado");
    expect(note).toHaveTextContent("ni saldo actual ni dinero disponible");
    expect(within(panel).getByText("Cobertura no verificada.")).toBeVisible();
    expect(panel).not.toHaveTextContent("mes completo del mismo año");
    const chart = within(panel).getByRole("img", { name: "Ahorro acumulado en 2026" });
    expect(note.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel).toHaveTextContent("Diciembre: 46,00");
    expect(panel).toHaveTextContent("10,00 € al mes");
    const table = within(panel).getByRole("table", { name: "Aportes y acumulado por mes", hidden: true });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("2026-01Real2,00 €2,00 €");
    expect(rows[1]).toHaveTextContent("2026-02Estimado4,00 €6,00 €");
    expect(rows[11]).toHaveTextContent("2026-12Estimado4,00 €46,00 €");
  });

  it("keeps sparse recorded flow and zero months visibly unverified", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      key: `2026-${String(index + 1).padStart(2, "0")}`, month: index + 1,
      startDate: `2026-${String(index + 1).padStart(2, "0")}-01` as IsoDate,
      endDate: `2026-${String(index + 1).padStart(2, "0")}-28` as IsoDate,
      kind: "actual" as const, incomeMinor: 0, observedIncomeEurMinor: 0,
      budgetMinor: 100, monthlyContributionEurMinor: index === 0 || index === 11 ? -100 : 0,
      cumulativeEurMinor: index === 11 ? -200 : -100,
    }));
    const projection = {
      status: "ready", year: 2026, currency: "EUR", fractionDigits: 2,
      dateScope: "full-budget-calendar-year", dateBasis: "operation",
      coverage: { from: "2026-01-01", to: "2026-12-31" },
      income: { basis: "same-year-complete-month-mean", completeMonthCount: 12,
        completeMonthKeys: points.map((point) => point.key), totalMinor: 0, expectedMonthlyMinor: null },
      budget: { grouping: "YEAR", distribution: "even-calendar-months", annualBudgetMinor: 1_200 },
      points,
    } satisfies AnnualProjectionResult;
    render(<AnnualProjection error={null} result={projection} />);
    const panel = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    const warning = within(panel).getByText("Cobertura no verificada.").closest("p")!;
    expect(warning).toBeVisible();
    expect(warning).toHaveTextContent("Sin registros puede faltar información, no necesariamente actividad");
    const chart = within(panel).getByRole("img", { name: "Ahorro acumulado en 2026" });
    expect(warning.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel).toHaveTextContent("Diciembre: -2,00");
    expect(panel).not.toHaveTextContent("meses completos");
    expect(panel).not.toHaveTextContent("cobertura completa");
    expect(panel).not.toHaveTextContent("Escenario condicionado al presupuesto");
    const table = within(panel).getByRole("table", { name: "Aportes y acumulado por mes", hidden: true });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows[1]).toHaveTextContent("2026-02Real0,00 €-1,00 €");
    expect(rows[11]).toHaveTextContent("2026-12Real-1,00 €-2,00 €");
  });

  it("does not call empty or insufficient records certified zero activity", () => {
    render(<AnnualProjection error={null} result={{ status: "unavailable", reason: "no-complete-months" }} />);
    const panel = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    expect(panel).toHaveTextContent("No hay meses cerrados dentro del intervalo observado de este año para estimar ingresos");
    expect(panel).toHaveTextContent("La ausencia de registros no confirma ausencia de actividad");
    expect(panel).not.toHaveTextContent("completo y cubierto");
    expect(within(panel).queryByRole("img")).not.toBeInTheDocument();
    expect(panel).not.toHaveTextContent("Diciembre:");
  });
});
