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
    expect(panel).toHaveTextContent("12 meses completos");
    expect(panel).toHaveTextContent("12 meses naturales");
    expect(panel).toHaveTextContent("céntimos restantes");
    expect(within(panel).getByRole("img", { name: "Ahorro acumulado en 2026" })).toBeVisible();
  });
});
