import { useMemo, useState } from "react";

import {
  buildPeriodComparison,
  type ComparisonMode,
  type PeriodComparisonMetric,
} from "../../../../domain/analytics/comparison.ts";
import type { IsoDate } from "../../../../domain/analytics/types.ts";
import { formatDate, formatEuroMinor } from "../../../utils/format.ts";
import { DataTable } from "../DataTable/index.ts";
import type { DataTableColumn } from "../DataTable/index.ts";
import styles from "./PeriodComparison.module.css";
import type { PeriodComparisonProps } from "./PeriodComparison.types.ts";

const percentFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const columns: readonly DataTableColumn<PeriodComparisonMetric>[] = [
  { key: "metric", header: "Estadística", cell: (metric) => <span className={styles.metricLabel}>{metric.label}</span>, rowHeader: true },
  { key: "current", header: "Actual", cell: (metric) => formatEuroMinor(metric.currentEurMinor), align: "end" },
  { key: "reference", header: "Referencia", cell: (metric) => formatEuroMinor(metric.referenceEurMinor), align: "end" },
  { key: "delta", header: "Diferencia", cell: (metric) => `${metric.deltaEurMinor > 0 ? "+" : ""}${formatEuroMinor(metric.deltaEurMinor)}`, align: "end" },
  { key: "percent", header: "Variación", cell: (metric) => metric.deltaPercent === null ? "Sin base" : `${percentFormatter.format(metric.deltaPercent)} %`, align: "end" },
];

export function PeriodComparison({ filtered }: PeriodComparisonProps) {
  const [mode, setMode] = useState<ComparisonMode>("none");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = mode === "custom" && from !== "" && to !== "" && from > to;
  const comparison = useMemo(() => {
    if (invalidRange) return null;
    return buildPeriodComparison(filtered, {
      mode,
      ...(mode === "custom" && from !== "" && to !== ""
        ? { dateRange: { from: from as IsoDate, to: to as IsoDate } }
        : {}),
    });
  }, [filtered, from, invalidRange, mode, to]);

  return (
    <details className={styles.root}>
      <summary className={styles.summary}>Comparar periodos{mode === "none" ? "" : " · Comparación activa"}</summary>
      <section aria-label="Comparación de periodos" className={styles.content}>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span>Comparar con</span>
          <select onChange={(event) => setMode(event.currentTarget.value as ComparisonMode)} value={mode}>
            <option value="none">Sin comparación</option>
            <option value="previousPeriod">Periodo anterior</option>
            <option value="previousYear">Mismo periodo del año anterior</option>
            <option value="custom">Rango personalizado</option>
          </select>
        </label>
        {mode === "custom" ? <>
          <label className={styles.field}>
            <span>Referencia desde</span>
            <input aria-invalid={invalidRange} max={to || undefined} onChange={(event) => setFrom(event.currentTarget.value)} type="date" value={from} />
          </label>
          <label className={styles.field}>
            <span>Referencia hasta</span>
            <input aria-invalid={invalidRange} min={from || undefined} onChange={(event) => setTo(event.currentTarget.value)} type="date" value={to} />
          </label>
        </> : null}
      </div>
      {invalidRange ? <p role="alert">El inicio de referencia debe ser anterior o igual al final.</p> : null}
      {comparison !== null ? <>
        <p className={styles.description}>
          Actual: {formatDate(comparison.currentRange.from)} – {formatDate(comparison.currentRange.to)} · Referencia: {formatDate(comparison.referenceRange.from)} – {formatDate(comparison.referenceRange.to)}.
          {" "}Mismos filtros y fecha de {filtered.filters.dateBasis === "value" ? "valor (operación si falta)" : "operación"}.
        </p>
        <DataTable caption="Importes del periodo actual frente a la referencia" columns={columns} rowKey={(metric) => metric.key} rows={comparison.metrics} />
        <p className={styles.description}>
          Diferencia = actual − referencia. El porcentaje usa el valor absoluto de referencia; con base cero no se calcula.
          {" "}Las entradas y salidas incluyen transferencias entre las cuentas seleccionadas; no son ingresos ni gastos por sí solas.
        </p>
        <p className={styles.description}>
          Las estadísticas de deuda usan las cuentas de deuda incluidas en el ámbito y la selección.
          {" "}El saldo final completo se mide al final de cada rango y conserva todo el historial de esas cuentas, aunque filtres categorías, origen, destino, estados, etiquetas o búsqueda.
          {" "}Las contrapartidas muestran ajustes contables de transferencias verificadas; no son devoluciones cobradas.
        </p>
        {comparison.referenceOutsideHistory ? <p className={styles.description}>
          La referencia se extiende fuera de las fechas con movimientos del archivo. Los ceros no garantizan que el historial esté completo.
        </p> : null}
        {comparison.referencePostingCount === 0 ? <p className={styles.description}>No hay movimientos no anulados en la referencia con estos filtros.</p> : null}
      </> : mode !== "none" && !invalidRange ? <p className={styles.description}>
        {mode === "custom" ? "Completa las dos fechas de referencia." : "Selecciona un periodo con fechas para comparar."}
      </p> : null}
      </section>
    </details>
  );
}
