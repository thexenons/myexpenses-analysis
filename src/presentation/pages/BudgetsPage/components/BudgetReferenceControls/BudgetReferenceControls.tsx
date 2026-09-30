import { useId, useState } from "react";

import type { BackupDatasetPreferencesV1 } from "../../../../../domain/analytics/backup-dataset.types.ts";
import type { BudgetReference, BudgetReferenceRange } from "../../../../../domain/analytics/budget-period-comparison.ts";
import { budgetPeriodForDate, type BudgetPeriod } from "../../../../../domain/analytics/budgets.ts";
import type { IsoDate } from "../../../../../domain/analytics/types.ts";
import { assertIsoDate } from "../../../../../domain/analytics/validation.ts";
import { formatDate } from "../../../../utils/format.ts";
import styles from "./BudgetReferenceControls.module.css";

interface BudgetReferenceControlsProps {
  readonly period: BudgetPeriod;
  readonly preferences: BackupDatasetPreferencesV1;
  readonly references: readonly BudgetReference[];
  readonly primaryReferenceKey: string | null;
  readonly onAdd: (range: BudgetReferenceRange) => void;
  readonly onRemove: (key: string) => void;
  readonly onPrimaryChange: (key: string) => void;
}

function validDate(value: string): IsoDate | null {
  if (value === "") return null;
  try {
    return assertIsoDate(value, "Reference date");
  } catch {
    return null;
  }
}

export function BudgetReferenceControls({
  period, preferences, references, primaryReferenceKey, onAdd, onRemove, onPrimaryChange,
}: BudgetReferenceControlsProps) {
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const summary = references.length === 0 ? "Sin referencias" : `Referencias · ${references.length}`;
  const errorId = useId();

  const add = () => {
    let range: BudgetReferenceRange | null = null;
    if (period.grouping === "NONE") {
      const startDate = validDate(from);
      const endDate = validDate(to);
      if (startDate === null || endDate === null) {
        setError("Indica ambas fechas de referencia.");
        return;
      }
      if (startDate > endDate) {
        setError("La fecha inicial debe ser anterior o igual a la final.");
        return;
      }
      range = {
        key: `custom:${startDate}:${endDate}`,
        label: `${formatDate(startDate)} – ${formatDate(endDate)}`,
        startDate, endDate,
      };
    } else {
      const selectedDate = validDate(date);
      if (selectedDate === null) {
        setError("Indica una fecha de referencia válida.");
        return;
      }
      range = budgetPeriodForDate(period.grouping, selectedDate, preferences);
      if (range === null) {
        setError("No se puede representar ese periodo.");
        return;
      }
    }
    if (references.some((reference) => reference.range.key === range.key)) {
      setError("Ese periodo ya está seleccionado.");
      return;
    }
    setError(null);
    onAdd(range);
    setDate("");
    setFrom("");
    setTo("");
  };

  return (
    <details className={styles.root}>
      <summary className={styles.summary}>{summary}</summary>
      <div className={styles.body}>
        {references.length === 0 ? <p className={styles.note}>Añade un periodo para comparar el gasto completo.</p> : (
          <>
            <label className={styles.field}>
              <span>Referencia principal</span>
              <select onChange={(event) => onPrimaryChange(event.currentTarget.value)} value={primaryReferenceKey ?? ""}>
                {references.map((reference) => (
                  <option key={reference.range.key} value={reference.range.key}>{reference.range.label}</option>
                ))}
              </select>
            </label>
            <ul className={styles.selected}>
              {references.map((reference) => (
                <li key={reference.range.key}>
                  <span>{reference.range.label}{reference.status === "unavailable" ? " · sin datos completos" : ""}</span>
                  <button aria-label={`Quitar referencia ${reference.range.label}`} onClick={() => onRemove(reference.range.key)} type="button">Quitar</button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={styles.add}>
          {period.grouping === "NONE" ? (
            <>
              <label className={styles.field}><span>Desde referencia</span><input onChange={(event) => setFrom(event.currentTarget.value)} type="date" value={from} /></label>
              <label className={styles.field}><span>Hasta referencia</span><input onChange={(event) => setTo(event.currentTarget.value)} type="date" value={to} /></label>
            </>
          ) : (
            <label className={styles.field}>
              <span>Fecha del periodo de referencia</span>
              <input onChange={(event) => setDate(event.currentTarget.value)} type="date" value={date} />
            </label>
          )}
          <button className={styles.addButton} onClick={add} type="button">
            {period.grouping === "NONE" ? "Añadir intervalo" : "Añadir periodo"}
          </button>
        </div>
        {error === null ? null : <p className={styles.error} id={errorId} role="alert">{error}</p>}
      </div>
    </details>
  );
}
