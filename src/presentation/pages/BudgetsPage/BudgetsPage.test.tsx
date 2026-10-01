import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  BudgetAllocationNode,
  BudgetAnalysis,
} from "../../../domain/analytics/budgets.ts";
import type { BackupBudgetV1 } from "../../../domain/analytics/backup-dataset.types.ts";
import type { BudgetPeriodComparison, BudgetReferenceRange } from "../../../domain/analytics/budget-period-comparison.ts";
import type { AnnualProjectionResult } from "../../../domain/analytics/annual-projection.ts";
import type { AnalyticsDataset, IsoDate, NormalizedPosting } from "../../../domain/analytics/types.ts";
import { analyzeBudgetPace } from "../../../domain/analytics/budget-pace.ts";
import { BudgetsPageView } from "./BudgetsPage.view.tsx";

const EMPTY_DATASET: AnalyticsDataset = {
  accounts: [], currency: "EUR", minDate: null, maxDate: null, postings: [],
  source: { accounts: { version: 2, accounts: {} }, categories: {} },
};

const budget: BackupBudgetV1 = {
  uuid: "budget",
  sourceId: 1,
  title: "Presupuesto doméstico",
  description: "",
  grouping: "MONTH",
  accountUuid: null,
  currency: "EUR",
  startDate: null,
  endDate: null,
  isDefault: true,
  filter: {
    type: "and",
    criteria: [
      {
        type: "account",
        accountUuids: ["a", "b", "c", "d", "e", "f", "g"],
      },
      { type: "category", categoryUuids: ["one", "two"] },
    ],
  },
  aggregateNeutral: false,
  allocations: [],
};

const allocation: BudgetAllocationNode = {
  id: "food",
  categoryUuid: "food",
  name: "Comida",
  path: ["Gastos", "Comida"],
  categoryType: "EXPENSE",
  depth: 1,
  hasDirectAllocation: true,
  allocationSource: "FALLBACK",
  oneTime: false,
  childAssignedMinor: 0,
  directConsumedMinor: 3_500,
  postingCount: 2,
  children: [],
  baseMinor: 3_000,
  rolloverPreviousMinor: 0,
  rolloverNextMinor: 0,
  assignedMinor: 3_000,
  consumedMinor: 3_500,
  availableMinor: -500,
  utilization: 3_500 / 3_000,
  health: "exceeded",
};

const analysis: BudgetAnalysis = {
  budget,
  period: {
    key: "MONTH:2026:7",
    grouping: "MONTH",
    year: 2026,
    second: 7,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    label: "Agosto de 2026",
  },
  periods: [
    {
      key: "MONTH:2026:7",
      grouping: "MONTH",
      year: 2026,
      second: 7,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      label: "Agosto de 2026",
    },
    {
      key: "MONTH:2026:6",
      grouping: "MONTH",
      year: 2026,
      second: 6,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      label: "Julio de 2026",
    },
  ],
  currency: "EUR",
  fractionDigits: 2,
  global: {
    baseMinor: 10_000,
    rolloverPreviousMinor: 1_000,
    rolloverNextMinor: 0,
    assignedMinor: 11_000,
    consumedMinor: 6_500,
    availableMinor: 4_500,
    utilization: 6_500 / 11_000,
    health: "on-track",
  },
  contributions: [],
  allocations: [allocation],
  categoryAssignedMinor: 9_000,
  categorizedConsumedMinor: 4_500,
  unallocatedConsumedMinor: 2_000,
  filteredPostingCount: 4,
  ownFilterApplied: true,
  aggregateNeutral: false,
  filterSummary: {
    rootOperator: "AND",
    accountCount: 7,
    categoryCount: 2,
  },
};

const comparison: BudgetPeriodComparison = {
  budgetUuid: "budget", targetPeriod: analysis.period, currency: "EUR", fractionDigits: 2,
  coverage: { from: "2026-06-01", to: "2026-08-31" }, primaryReferenceKey: "MONTH:2026:6",
  references: [
    { status: "complete", reason: null, range: analysis.periods[1]!, consumedMinor: 2_500,
      incomeMinor: 100, deltaMinor: 4_000, percentChange: 160 },
    { status: "complete", reason: null, range: { key: "MONTH:2026:5", label: "Junio de 2026", startDate: "2026-06-01", endDate: "2026-06-30" },
      consumedMinor: 0, incomeMinor: 0, deltaMinor: 6_500, percentChange: null },
  ],
  categories: [{
    categoryUuid: "food", name: "Comida", path: ["Gastos", "Comida"], currentConsumedMinor: 3_500,
    references: [
      { referenceKey: "MONTH:2026:6", consumedMinor: 2_500, amountMinor: 2_500, deltaMinor: 1_000, percentChange: 40 },
      { referenceKey: "MONTH:2026:5", consumedMinor: 0, amountMinor: 0, deltaMinor: 3_500, percentChange: null },
    ],
    mean: { averageMinor: 2_000, deltaMinor: 1_500, percentChange: 75 },
  }],
  mean: { status: "ready", reason: null, unit: "MONTH", periodCount: 2,
    periods: [analysis.periods[1]!], firstDate: "2026-06-01", lastDate: "2026-07-31",
    consumedTotalMinor: 4_000, consumedAverageMinor: 2_000,
    incomeTotalMinor: 200, incomeAverageMinor: 100 },
  elapsed: { cutoffDate: "2026-08-15", references: [{
    referenceKey: "MONTH:2026:6", status: "complete", reason: null,
    currentRange: { from: "2026-08-01", to: "2026-08-15" },
    referenceRange: { from: "2026-07-01", to: "2026-07-15" },
    currentConsumedMinor: 1_000, referenceConsumedMinor: 800, deltaMinor: 200, percentChange: 25,
    currentIncomeMinor: 200, referenceIncomeMinor: 100, incomeDeltaMinor: 100, incomePercentChange: 100,
    categories: [{ categoryUuid: "food", currentConsumedMinor: 500, referenceConsumedMinor: 400,
      deltaMinor: 100, percentChange: 25 }],
  }] },
  income: { scope: "income-category-postings", currentMinor: 200,
    references: [{ referenceKey: "MONTH:2026:6", amountMinor: 100, deltaMinor: 100, percentChange: 100 },
      { referenceKey: "MONTH:2026:5", amountMinor: 0, deltaMinor: 200, percentChange: null }],
    mean: { averageMinor: 100, deltaMinor: 100, percentChange: 100 } },
};

describe("BudgetsPageView", () => {
  it("shows a cumulative Jan–Dec trajectory with real/estimated evidence and December total", async () => {
    const user = userEvent.setup();
    const points = Array.from({ length: 12 }, (_, index) => ({
      key: `2026-${String(index + 1).padStart(2, "0")}`, month: index + 1,
      startDate: `2026-${String(index + 1).padStart(2, "0")}-01` as IsoDate,
      endDate: `2026-${String(index + 1).padStart(2, "0")}-28` as IsoDate,
      kind: index < 2 ? "actual" as const : "estimated" as const,
      incomeMinor: 900, observedIncomeEurMinor: index === 2 ? 100 : 0,
      budgetMinor: 500, monthlyContributionEurMinor: index === 1 ? -100 : 200,
      cumulativeEurMinor: index === 0 ? 200 : index === 1 ? 100 : 100 + (index - 1) * 200,
    }));
    const annualProjection = {
      status: "ready", year: 2026, currency: "EUR", fractionDigits: 2,
      dateScope: "full-budget-calendar-year", dateBasis: "operation",
      coverage: { from: "2026-01-01", to: "2026-02-28" },
      income: { basis: "same-year-complete-month-mean", completeMonthCount: 2,
        completeMonthKeys: ["2026-01", "2026-02"], totalMinor: 1_800, expectedMonthlyMinor: 900 },
      budget: { grouping: "MONTH", distribution: "per-calendar-month-label", annualBudgetMinor: 6_000 },
      points,
    } satisfies AnnualProjectionResult;
    render(<BudgetsPageView analysis={analysis} annualProjection={annualProjection}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null} onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7" />);
    const projection = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    expect(within(projection).getByRole("img", { name: "Ahorro acumulado en 2026" })).toBeVisible();
    expect(projection).toHaveTextContent("Diciembre: 21,00");
    expect(projection).toHaveTextContent("2 meses completos");
    expect(projection).toHaveTextContent("no se suma dos veces");
    expect(projection).toHaveTextContent("mes natural");
    expect(projection).toHaveTextContent("no es saldo inicial");
    await user.click(within(projection).getByText("Ver datos exactos"));
    const chartTable = within(projection).getByRole("table", { name: "Datos exactos de Ahorro acumulado en 2026" });
    expect(within(chartTable).getAllByRole("row")).toHaveLength(13);
    expect(within(chartTable).getByRole("row", { name: /2026-03/ })).toHaveTextContent("3,00");
    await user.click(within(projection).getByText("Desglose mensual"));
    const detail = within(projection).getByRole("table", { name: "Aportes y acumulado por mes" });
    expect(within(detail).getByRole("row", { name: /2026-02/ })).toHaveTextContent("Real");
    expect(within(detail).getByRole("row", { name: /2026-03/ })).toHaveTextContent("Estimado");
    expect(within(detail).getByRole("row", { name: /2026-03/ })).toHaveTextContent("2,00");
  });

  it("explains unavailable projection reasons without showing a fabricated chart", () => {
    const props = { analysis, dataset: EMPTY_DATASET, budgetOptions: [], periodOptions: [],
      emptyDescription: null, emptyTitle: null, onBudgetChange: vi.fn<(uuid: string) => void>(), onPeriodChange: vi.fn<(key: string) => void>(),
      searchPending: false, selectedBudgetUuid: "budget", selectedPeriodKey: "MONTH:2026:7" };
    const { rerender } = render(<BudgetsPageView {...props} annualProjection={{ status: "unavailable", reason: "no-complete-months" }} />);
    const projection = screen.getByRole("region", { name: "Proyección anual de ahorro" });
    expect(projection).toHaveTextContent("ningún mes completo");
    expect(within(projection).queryByRole("img", { name: /Ahorro acumulado/ })).not.toBeInTheDocument();
    rerender(<BudgetsPageView {...props} annualProjection={{ status: "unavailable", reason: "filtered-scope" }} />);
    expect(projection).toHaveTextContent("filtros de contenido");
    rerender(<BudgetsPageView {...props} annualProjectionError="calculation-error" />);
    expect(projection).toHaveTextContent("No se ha podido calcular");
  });
  it("shows signed monthly allowance and recorded refunds without calling it a forecast", async () => {
    const user = userEvent.setup();
    const posting = (id: string, date: IsoDate): NormalizedPosting => ({
      id, transactionId: id, sourceTransactionId: id, accountId: "account", accountLabel: "Cuenta",
      accountType: "DEFAULT", currency: "EUR", fractionDigits: 2, date,
      amountNativeMinor: -1_000, amountEurMinor: -1_000, exchangeRateToEur: 1,
      exchangeRateSource: "identity", categoryPath: ["Gastos", "Comida"], categoryType: "EXPENSE",
      bucket: "expense", status: "RECONCILED", isVoid: false, linked: false,
      tags: [], splitIndex: null, splitCount: null, payee: id,
    });
    const paced = { ...analysis, global: { ...analysis.global, baseMinor: 3_000, rolloverPreviousMinor: 100, assignedMinor: 3_100 },
      allocations: [{ ...allocation, baseMinor: 3_100, assignedMinor: 3_100 }],
      contributions: [
        { posting: posting("expense", "2026-08-02"), amountMinor: 2_500 },
        { posting: posting("refund", "2026-08-10"), amountMinor: -500 },
        { posting: posting("future", "2026-08-20"), amountMinor: 1_000 },
      ] } satisfies BudgetAnalysis;
    render(<BudgetsPageView analysis={paced} pace={analyzeBudgetPace(paced, "2026-08-15")}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null} onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7" />);
    const pace = screen.getByRole("region", { name: "Referencia lineal hasta la fecha" });
    expect(pace).toHaveTextContent("15,00");
    expect(pace).toHaveTextContent("Al 15 ago 2026");
    expect(pace).toHaveTextContent("por encima de la referencia");
    await user.click(within(pace).getByText("Cómo se calcula"));
    expect(pace).toHaveTextContent("31 días");
    expect(pace).toHaveTextContent("15 días");
    expect(pace).toHaveTextContent("base");
    expect(pace).toHaveTextContent("arrastre recibido");
    expect(pace).toHaveTextContent("apuntes registrados");
    expect(pace).toHaveTextContent("No garantiza que el historial esté completo");
    expect(pace).not.toHaveTextContent("previsión de gasto final");
    const toggle = screen.getByRole("button", { name: "Detalles de Gastos › Comida" });
    toggle.focus();
    await user.keyboard("{Enter}");
    const details = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(details).toHaveTextContent("Referencia lineal");
    expect(details).toHaveTextContent("por encima de la referencia");
  });

  it("explains annual partial-month pacing and preserves complete-period availability", () => {
    const annual = { ...analysis, period: { ...analysis.period, grouping: "YEAR" as const,
      startDate: "2026-01-01", endDate: "2026-12-31" },
      global: { ...analysis.global, baseMinor: 11_000, assignedMinor: 12_000 } } satisfies BudgetAnalysis;
    render(<BudgetsPageView analysis={annual} pace={analyzeBudgetPace(annual, "2026-03-15")}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null} onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="YEAR:2026" />);
    expect(screen.getByRole("region", { name: "Referencia lineal hasta la fecha" })).toHaveTextContent("por debajo de la referencia");
    expect(screen.getByRole("article", { name: "Disponible" })).toBeVisible();
    expect(screen.getByText("Cómo se calcula").closest("details")).toHaveTextContent("2 meses completos más 15/31 de marzo");
  });

  it("does not make pace claims for missing limits or incomplete filtered scopes", () => {
    const unavailable = { ...analysis, isFilteredComparison: true, hasNonDateSubsetFilters: true,
      consumptionDateRange: { from: "2026-08-10", to: "2026-08-15" } } satisfies BudgetAnalysis;
    const { rerender } = render(<BudgetsPageView analysis={unavailable} pace={analyzeBudgetPace(unavailable, "2026-08-15")}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null} onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7" />);
    expect(screen.getByRole("region", { name: "Referencia lineal hasta la fecha" })).toHaveTextContent("no disponible");
    expect(screen.getByRole("article", { name: "Asignado menos corte" })).toBeVisible();
    expect(screen.queryByText(/por debajo de la referencia/)).not.toBeInTheDocument();
    const zero = { ...analysis, global: { ...analysis.global, assignedMinor: 0 } } satisfies BudgetAnalysis;
    rerender(<BudgetsPageView analysis={zero} pace={analyzeBudgetPace(zero, "2026-08-15")}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null} onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7" />);
    expect(screen.getByRole("region", { name: "Referencia lineal hasta la fecha" })).toHaveTextContent("Sin límite total positivo");
  });

  it("allows a date-only prefix through today while keeping the full-budget warning", () => {
    const prefix = { ...analysis, isFilteredComparison: true, hasNonDateSubsetFilters: false,
      consumptionDateRange: { from: "2026-08-01" as const, to: "2026-08-15" as const } } satisfies BudgetAnalysis;
    render(<BudgetsPageView analysis={prefix} pace={analyzeBudgetPace(prefix, "2026-08-15")}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null} onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7" />);
    expect(screen.getByRole("region", { name: "Referencia lineal hasta la fecha" })).toHaveTextContent("Al 15 ago 2026");
    expect(screen.getByRole("article", { name: "Asignado menos corte" })).toBeVisible();
    expect(screen.getByText(/no indican la disponibilidad real del presupuesto completo/)).toBeVisible();
    expect(screen.getByText("Cómo se calcula").closest("details")).toHaveTextContent("El corte solo abarca las fechas desde el inicio hasta hoy");
  });

  it("gives neutral reasons for future or unsupported pace periods", () => {
    const props = { dataset: EMPTY_DATASET, budgetOptions: [], periodOptions: [],
      emptyDescription: null, emptyTitle: null, onBudgetChange: vi.fn<(uuid: string) => void>(),
      onPeriodChange: vi.fn<(key: string) => void>(), searchPending: false,
      selectedBudgetUuid: "budget", selectedPeriodKey: "MONTH:2026:7" };
    const { rerender } = render(<BudgetsPageView {...props} analysis={analysis} pace={analyzeBudgetPace(analysis, "2026-07-31")} />);
    expect(screen.getByRole("region", { name: "Referencia lineal hasta la fecha" })).toHaveTextContent("el periodo aún no ha comenzado");
    expect(screen.queryByText(/por debajo de la referencia/)).not.toBeInTheDocument();
    const unsupported = { ...analysis, period: { ...analysis.period, grouping: "WEEK" as const } };
    rerender(<BudgetsPageView {...props} analysis={unsupported} pace={analyzeBudgetPace(unsupported, "2026-08-15")} />);
    expect(screen.getByRole("region", { name: "Referencia lineal hasta la fecha" })).toHaveTextContent("no tiene una unidad mensual o anual comparable");
  });
  it("places budget comparisons before secondary ledger and method information", async () => {
    const user = userEvent.setup();
    render(<BudgetsPageView
      analysis={analysis} comparison={comparison} dataset={EMPTY_DATASET}
      budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);

    const tree = screen.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
    const summary = screen.getByText("Información del presupuesto");
    const information = summary.closest("details");
    expect(information).not.toHaveAttribute("open");
    expect(tree.compareDocumentPosition(information!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.getByText("Asignaciones categorizadas").closest("details")).toBe(information);
    expect(screen.getByText(/fila técnica sin categoría/i).closest("details")).toBe(information);
    expect(screen.getByText("Los hijos detallan el total del padre; no se suman de nuevo.")).toBeVisible();
    expect(screen.getByText(/2 meses completos/i)).toBeVisible();
    expect(screen.getByRole("region", { name: "Ingresos en el mismo ámbito" })).toBeVisible();

    await user.click(summary);
    expect(information).toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("keeps date mismatch and exceeded-limit warnings beside the primary amounts", () => {
    render(<BudgetsPageView
      analysis={{ ...analysis, consumptionDateRange: null, global: { ...analysis.global,
        consumedMinor: 12_000, availableMinor: -1_000, utilization: 12_000 / 11_000, health: "exceeded" } }}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]}
      emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);

    expect(screen.getByText(/No hay solapamiento entre las fechas globales/)).toBeVisible();
    expect(screen.getByText("Límite total excedido.")).toBeVisible();
    expect(screen.getByRole("article", { name: "Gasto neto" })).toBeVisible();
    expect(screen.getByText("Información del presupuesto").closest("details")).not.toHaveAttribute("open");
  });

  it("shows a neutral comparison failure without hiding the current budget or exposing the technical reason", () => {
    render(<BudgetsPageView
      analysis={analysis} comparisonError="Private calculation detail" dataset={EMPTY_DATASET}
      budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);
    expect(screen.getByText("No se ha podido calcular la comparación con los datos actuales.")).toBeVisible();
    expect(screen.queryByText(/Private calculation detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver apuntes consumidos de Gastos › Comida/ })).toBeVisible();
  });

  it("shows primary and mean values at a glance, with other deltas and elapsed pace in details", async () => {
    const user = userEvent.setup();
    render(<BudgetsPageView
      analysis={analysis} comparison={comparison} dataset={EMPTY_DATASET}
      budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      onReferenceAdd={vi.fn<(range: BudgetReferenceRange) => void>()} onReferenceRemove={vi.fn<(key: string) => void>()} onPrimaryReferenceChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);
    expect(screen.getByText(/2 meses completos/i)).toBeVisible();
    const tree = screen.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
    expect(within(tree).getByText("Referencia")).toBeVisible();
    expect(within(tree).getByText("Media")).toBeVisible();
    expect(within(tree).getAllByText(/25,00/).find((node) => node.closest("[hidden]") === null)).toBeVisible();
    expect(within(tree).getAllByText(/20,00/).find((node) => node.closest("[hidden]") === null)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Detalles de Gastos › Comida" }));
    expect(within(tree).getByText(/Junio de 2026/)).toBeVisible();
    expect(within(tree).getByText(/Mismo tramo transcurrido/)).toBeVisible();
    expect(screen.getByText(/Ingresos en el mismo ámbito/)).toBeVisible();
  });

  it("distinguishes an empty reference selection, missing history and a custom unit", () => {
    const noHistory: BudgetPeriodComparison = {
      ...comparison,
      primaryReferenceKey: null,
      references: [],
      categories: [{ ...comparison.categories[0]!, references: [], mean: { averageMinor: null, deltaMinor: null, percentChange: null } }],
      mean: { ...comparison.mean, status: "no-complete-history", reason: "no-complete-history",
        periodCount: 0, periods: [], firstDate: null, lastDate: null,
        consumedTotalMinor: null, consumedAverageMinor: null, incomeTotalMinor: null, incomeAverageMinor: null },
    };
    const { rerender } = render(<BudgetsPageView
      analysis={analysis} comparison={noHistory} dataset={EMPTY_DATASET}
      budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);
    const tree = screen.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
    expect(within(tree).getByText("Sin referencia")).toBeVisible();
    expect(within(tree).getByText("Sin historial")).toBeVisible();
    expect(screen.getByText(/no hay periodos anteriores completos/)).toBeVisible();
    rerender(<BudgetsPageView
      analysis={{ ...analysis, period: { ...analysis.period, grouping: "NONE" } }}
      comparison={{ ...noHistory, mean: { ...noHistory.mean, status: "unsupported-grouping", reason: "custom-range-has-no-calendar-unit", unit: null } }}
      dataset={EMPTY_DATASET} budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="NONE:all:all"
    />);
    expect(within(tree).getByText("Sin unidad")).toBeVisible();
    expect(screen.getByText(/intervalo libre no tiene una unidad comparable/)).toBeVisible();
  });

  it("gives a short above-reference signal without replacing current budget semantics", () => {
    render(<BudgetsPageView
      analysis={{ ...analysis, allocations: [{ ...allocation, health: "on-track", assignedMinor: 5_000, availableMinor: 1_500, utilization: 0.7 }] }}
      comparison={comparison} dataset={EMPTY_DATASET}
      budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);
    expect(screen.getByText(/10,00.*más que la referencia/)).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización de Gastos › Comida" })).toBeVisible();
  });
  it("shows the absence of a total limit instead of a calculated zero percent", () => {
    render(
      <BudgetsPageView
        analysis={{ ...analysis, filteredPostingCount: 1, global: { ...analysis.global, assignedMinor: 0, utilization: null, health: "unallocated" } }}
        dataset={EMPTY_DATASET}
        budgetOptions={[]}
        emptyDescription={null}
        emptyTitle={null}
        onBudgetChange={vi.fn<(value: string) => void>()}
        onPeriodChange={vi.fn<(value: string) => void>()}
        periodOptions={[]}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey="MONTH:2026:7"
      />,
    );
    const utilization = screen.getByRole("article", { name: "Utilización" });
    expect(utilization).toHaveTextContent("Sin límite total");
    expect(utilization).not.toHaveTextContent("0 %");
    expect(utilization.querySelector("data")).toBeNull();
    expect(screen.getByText("1 apunte efectivo")).toBeVisible();
  });
  it("opens exact global and category details without changing filters or the accordion", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
        this.addEventListener("keydown", (event) => {
          if (event.key === "Escape") this.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }));
        }, { once: true });
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = false; },
    });
    const user = userEvent.setup();
    const makePosting = (id: string, categoryPath: string[]): NormalizedPosting => ({
      id, transactionId: id, sourceTransactionId: id,
      accountId: "account", accountLabel: "Cuenta", accountType: "DEFAULT",
      currency: "EUR", fractionDigits: 2, date: "2026-08-03",
      amountNativeMinor: -4_000, amountEurMinor: -4_000,
      exchangeRateToEur: 1, exchangeRateSource: "identity",
      categoryPath, categoryType: "EXPENSE", bucket: "expense",
      status: "RECONCILED", isVoid: false, linked: false, tags: [],
      splitIndex: null, splitCount: null, payee: id,
    });
    const onBudgetChange = vi.fn<(uuid: string) => void>();
    const onPeriodChange = vi.fn<(key: string) => void>();
    render(
      <BudgetsPageView
        analysis={{
          ...analysis,
          contributions: [
            { posting: makePosting("child-expense", ["Gastos", "Comida"]), amountMinor: 4_000 },
            { posting: makePosting("child-refund", ["Gastos", "Comida"]), amountMinor: -500 },
            { posting: makePosting("other", ["Otros"]), amountMinor: 3_000 },
          ],
        }}
        comparison={comparison}
        dataset={EMPTY_DATASET}
        budgetOptions={[]}
        emptyDescription={null}
        emptyTitle={null}
        onBudgetChange={onBudgetChange}
        onPeriodChange={onPeriodChange}
        periodOptions={[]}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey="MONTH:2026:7"
      />,
    );

    const globalTrigger = screen.getByRole("button", { name: "Ver apuntes del gasto neto" });
    globalTrigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Gasto neto · apuntes" })).toBeVisible();
    expect(screen.getByText("child-expense")).toBeVisible();
    expect(screen.getByText("child-refund")).toBeVisible();
    expect(screen.getByText("other")).toBeVisible();
    expect(screen.getByText(/3 apuntes/)).toHaveTextContent("65,00");
    await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(globalTrigger).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /Ver apuntes consumidos de Gastos › Comida: 35,00/ }));
    expect(screen.getByRole("dialog", { name: "Gastos › Comida · apuntes" })).toBeVisible();
    expect(screen.getByText("child-expense")).toBeVisible();
    expect(screen.getByText("child-refund")).toBeVisible();
    expect(screen.queryByText("other")).not.toBeInTheDocument();
    expect(screen.getByText(/2 apuntes/)).toHaveTextContent("35,00");
    expect(within(screen.getByRole("dialog", { name: "Gastos › Comida · apuntes" })).getAllByText("Gastos › Comida")[0]).toBeVisible();
    expect(onBudgetChange).not.toHaveBeenCalled();
    expect(onPeriodChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("distinguishes a filtered comparison from the full budget availability", () => {
    render(
      <BudgetsPageView
        analysis={{ ...analysis, dateBasis: "value", consumptionDateRange: { from: "2026-08-10", to: "2026-08-12" }, isFilteredComparison: true }}
        dataset={EMPTY_DATASET}
        budgetOptions={[{ value: "budget", label: "Presupuesto doméstico" }]}
        emptyDescription={null}
        emptyTitle={null}
        onBudgetChange={vi.fn<(uuid: string) => void>()}
        onPeriodChange={vi.fn<(key: string) => void>()}
        periodOptions={[]}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey="MONTH:2026:7"
      />,
    );
    expect(screen.getAllByText("Asignado menos corte")).toHaveLength(2);
    expect(screen.getByText(/Consumo consultado:/)).toHaveTextContent("Consumo consultado: 10 ago 2026 – 12 ago 2026");
    expect(screen.getByText(/sin prorratear/)).toBeVisible();
    expect(screen.getByText(/no indican la disponibilidad real del presupuesto completo/)).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización del corte filtrado" })).toBeVisible();
    expect(screen.queryByText("Dentro del límite total.")).not.toBeInTheDocument();
  });

  it("labels complete-budget consumption without implying a time-based pace", () => {
    render(<BudgetsPageView
      analysis={{ ...analysis, isFilteredComparison: false }} dataset={EMPTY_DATASET}
      budgetOptions={[]} periodOptions={[]} emptyDescription={null} emptyTitle={null}
      onBudgetChange={vi.fn<(uuid: string) => void>()} onPeriodChange={vi.fn<(key: string) => void>()}
      searchPending={false} selectedBudgetUuid="budget" selectedPeriodKey="MONTH:2026:7"
    />);
    expect(screen.getByRole("meter", { name: "Consumo del presupuesto" })).toBeVisible();
    expect(screen.queryByText("Ritmo de consumo total")).not.toBeInTheDocument();
  });

  it("does not describe a filtered slice as on track when the full budget is exceeded", async () => {
    const user = userEvent.setup();
    render(
      <BudgetsPageView
        analysis={{
          ...analysis,
          isFilteredComparison: true,
          global: { ...analysis.global, assignedMinor: 10_000, consumedMinor: 1_000, availableMinor: 9_000, utilization: 0.1, health: "on-track" },
          allocations: [{ ...allocation, assignedMinor: 10_000, consumedMinor: 1_000, availableMinor: 9_000, utilization: 0.1, health: "on-track" }],
        }}
        dataset={EMPTY_DATASET}
        budgetOptions={[]}
        emptyDescription={null}
        emptyTitle={null}
        onBudgetChange={vi.fn<(value: string) => void>()}
        onPeriodChange={vi.fn<(value: string) => void>()}
        periodOptions={[]}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey="MONTH:2026:7"
      />,
    );
    // The unselected 120 € may push actual spending to 130 €.
    expect(screen.queryByText("En margen")).not.toBeInTheDocument();
    expect(screen.queryByText("Disponible", { exact: true })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Detalles de Gastos › Comida"));
    expect(screen.getByText("Corte filtrado")).toBeVisible();
  });

  it("renders budget KPIs, the independent total allocation and hierarchy", async () => {
    const user = userEvent.setup();
    const onBudgetChange = vi.fn<(uuid: string) => void>();
    const onPeriodChange = vi.fn<(key: string) => void>();
    render(
      <BudgetsPageView
        analysis={analysis}
        dataset={EMPTY_DATASET}
        budgetOptions={[
          { value: "budget", label: "Presupuesto doméstico" },
          { value: "second", label: "Segundo presupuesto" },
        ]}
        emptyDescription={null}
        emptyTitle={null}
        onBudgetChange={onBudgetChange}
        onPeriodChange={onPeriodChange}
        periodOptions={analysis.periods.map((period) => ({
          value: period.key,
          label: period.label,
        }))}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey="MONTH:2026:7"
      />,
    );

    expect(screen.getByRole("heading", { name: "Presupuestos" })).toBeVisible();
    const totalAllocation = screen.getByRole("article", { name: "Asignado total" });
    expect(totalAllocation).toBeVisible();
    expect(within(totalAllocation).getByText(/No se calcula sumando categorías/)).toBeVisible();
    expect(screen.getByText("Información del presupuesto").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Gasto neto")).toBeVisible();
    expect(screen.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" })).toBeVisible();
    expect(screen.getByText("Comida")).toBeVisible();
    expect(screen.getByRole("meter", { name: "Utilización de Gastos › Comida" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Filtrar.*Comida/ })).not.toBeInTheDocument();
    const detailsToggle = screen.getByRole("button", { name: "Detalles de Gastos › Comida" });
    await user.click(detailsToggle);
    const details = document.getElementById(detailsToggle.getAttribute("aria-controls")!);
    expect(within(details!).getByText("Heredada")).toBeVisible();
    expect(within(details!).getByText("Excedido")).toBeVisible();
    await user.click(screen.getByText("Información del presupuesto"));
    expect(screen.getByText("AND · 7 cuentas · 2 categorías")).toBeVisible();
    expect(screen.getAllByRole("meter").length).toBeGreaterThan(1);
    expect(
      screen.getByText(/fila técnica sin categoría/i),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Presupuesto"), "second");
    expect(onBudgetChange).toHaveBeenCalledWith("second");
    await user.selectOptions(screen.getByLabelText("Periodo"), "MONTH:2026:6");
    expect(onPeriodChange).toHaveBeenCalledWith("MONTH:2026:6");
  });

  it("exposes unsupported semantics instead of silently fabricating a result", () => {
    render(
      <BudgetsPageView
        analysis={null}
        dataset={EMPTY_DATASET}
        budgetOptions={[{ value: "budget", label: "Presupuesto doméstico" }]}
        emptyDescription="No hay periodos configurados que puedan representarse sin inferencias."
        emptyTitle="Presupuesto no representable con seguridad"
        onBudgetChange={vi.fn<(uuid: string) => void>()}
        onPeriodChange={vi.fn<(key: string) => void>()}
        periodOptions={[]}
        searchPending={false}
        selectedBudgetUuid="budget"
        selectedPeriodKey=""
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Presupuesto no representable con seguridad",
      }),
    ).toBeVisible();
    expect(screen.getByText(/sin inferencias/i)).toBeVisible();
    expect(screen.getByLabelText("Periodo")).toBeDisabled();
  });
});
