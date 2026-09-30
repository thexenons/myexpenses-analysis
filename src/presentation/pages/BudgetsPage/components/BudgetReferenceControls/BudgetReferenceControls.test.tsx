import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BackupDatasetPreferencesV1 } from "../../../../../domain/analytics/backup-dataset.types.ts";
import type { BudgetReference, BudgetReferenceRange } from "../../../../../domain/analytics/budget-period-comparison.ts";
import type { BudgetPeriod } from "../../../../../domain/analytics/budgets.ts";
import { BudgetReferenceControls } from "./BudgetReferenceControls.tsx";

const preferences: BackupDatasetPreferencesV1 = {
  homeCurrency: "EUR", timeZone: "Europe/Madrid", monthStart: 1, weekStart: 1, includeTransfers: true,
};
const period: BudgetPeriod = {
  key: "MONTH:2026:7", grouping: "MONTH", year: 2026, second: 7,
  startDate: "2026-08-01", endDate: "2026-08-31", label: "Agosto de 2026",
};
const references: BudgetReference[] = [
  { status: "complete", reason: null, range: { key: "MONTH:2026:6", label: "Julio de 2026", startDate: "2026-07-01", endDate: "2026-07-31" },
    consumedMinor: 500, incomeMinor: 0, deltaMinor: 100, percentChange: 20 },
  { status: "complete", reason: null, range: { key: "MONTH:2026:5", label: "Junio de 2026", startDate: "2026-06-01", endDate: "2026-06-30" },
    consumedMinor: 0, incomeMinor: 0, deltaMinor: 600, percentChange: null },
];

describe("BudgetReferenceControls", () => {
  it("adds a calendar period, rejects duplicates and changes/removes the primary independently", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(range: BudgetReferenceRange) => void>();
    const onRemove = vi.fn<(key: string) => void>();
    const onPrimaryChange = vi.fn<(key: string) => void>();
    render(<BudgetReferenceControls period={period} preferences={preferences}
      references={references} primaryReferenceKey="MONTH:2026:6"
      onAdd={onAdd} onRemove={onRemove} onPrimaryChange={onPrimaryChange} />);
    await user.click(screen.getByText(/Referencias · 2/));
    await user.selectOptions(screen.getByLabelText("Referencia principal"), "MONTH:2026:5");
    expect(onPrimaryChange).toHaveBeenCalledWith("MONTH:2026:5");
    await user.type(screen.getByLabelText("Fecha del periodo de referencia"), "2026-05-18");
    await user.click(screen.getByRole("button", { name: "Añadir periodo" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      key: "MONTH:2026:4", startDate: "2026-05-01", endDate: "2026-05-31",
    }));
    await user.clear(screen.getByLabelText("Fecha del periodo de referencia"));
    await user.type(screen.getByLabelText("Fecha del periodo de referencia"), "2026-07-20");
    await user.click(screen.getByRole("button", { name: "Añadir periodo" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("ya está seleccionado");
    await user.click(screen.getByRole("button", { name: "Quitar referencia Julio de 2026" }));
    expect(onRemove).toHaveBeenCalledWith("MONTH:2026:6");
  });

  it("requires an explicit ordered interval for ungrouped budgets", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(range: BudgetReferenceRange) => void>();
    render(<BudgetReferenceControls period={{ ...period, key: "NONE:all:all", grouping: "NONE" }}
      preferences={preferences} references={[]} primaryReferenceKey={null}
      onAdd={onAdd} onRemove={vi.fn<(key: string) => void>()} onPrimaryChange={vi.fn<(key: string) => void>()} />);
    await user.click(screen.getByText(/Sin referencias/));
    await user.click(screen.getByRole("button", { name: "Añadir intervalo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Indica ambas fechas");
    await user.type(screen.getByLabelText("Desde referencia"), "2026-07-31");
    await user.type(screen.getByLabelText("Hasta referencia"), "2026-07-01");
    await user.click(screen.getByRole("button", { name: "Añadir intervalo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("fecha inicial");
    await user.clear(screen.getByLabelText("Desde referencia"));
    await user.type(screen.getByLabelText("Desde referencia"), "2026-07-01");
    await user.click(screen.getByRole("button", { name: "Añadir intervalo" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      key: "custom:2026-07-01:2026-07-01", startDate: "2026-07-01", endDate: "2026-07-01",
    }));
  });
});
