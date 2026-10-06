import { useMemo, useState } from "react";

import {
  buildPeriodComparison,
  categoryComparisonFilters,
  type ComparisonMode,
  type PeriodComparisonMetric,
} from "../../../../domain/analytics/comparison.ts";
import type { IsoDate } from "../../../../domain/analytics/types.ts";
import { formatDate, formatEuroMinor } from "../../../utils/format.ts";
import { Button } from "../../atoms/Button/index.ts";
import { DataTable } from "../DataTable/index.ts";
import type { DataTableColumn } from "../DataTable/index.ts";
import { CumulativeCurve } from "./PeriodComparison.curve.tsx";
import styles from "./PeriodComparison.module.css";
import type { PeriodComparisonProps } from "./PeriodComparison.types.ts";

const percentFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const highlightedKeys = ["income", "expenses", "net"] as const;
const formatDelta = (amount: number) => `${amount > 0 ? "+" : ""}${formatEuroMinor(amount)}`;
const formatVariation = (percent: number | null) => percent === null ? "Sin base" : `${percentFormatter.format(percent)} %`;
const columns: readonly DataTableColumn<PeriodComparisonMetric>[] = [
  { key: "metric", header: "Estadística", cell: (metric) => <span className={styles.metricLabel}>{metric.label}</span>, rowHeader: true },
  { key: "current", header: "Actual", cell: (metric) => formatEuroMinor(metric.currentEurMinor), align: "end" },
  { key: "reference", header: "Referencia", cell: (metric) => formatEuroMinor(metric.referenceEurMinor), align: "end" },
  { key: "delta", header: "Diferencia", cell: (metric) => formatDelta(metric.deltaEurMinor), align: "end" },
  { key: "percent", header: "Variación", cell: (metric) => formatVariation(metric.deltaPercent), align: "end" },
];

export function PeriodComparison({ filtered, searchPending = false, onViewCategory }: PeriodComparisonProps) {
  const [outerOpen, setOuterOpen] = useState(false);
  const [mode, setMode] = useState<ComparisonMode>("none");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [curveOpen, setCurveOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const invalidRange = mode === "custom" && from !== "" && to !== "" && from > to;
  const comparison = useMemo(() => {
    if (invalidRange) return null;
    return buildPeriodComparison(filtered, {
      mode,
      includeCategories: outerOpen && categoriesOpen,
      ...(mode === "custom" && from !== "" && to !== ""
        ? { dateRange: { from: from as IsoDate, to: to as IsoDate } }
        : {}),
    });
  }, [categoriesOpen, filtered, from, invalidRange, mode, outerOpen, to]);
  const highlighted = comparison === null ? [] : highlightedKeys.flatMap((key) => {
    const metric = comparison.metrics.find((candidate) => candidate.key === key);
    return metric === undefined ? [] : [metric];
  });

  return (
    <details className={styles.root} onToggle={(event) => setOuterOpen(event.currentTarget.open)} open={outerOpen}>
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
        {comparison.referenceOutsideHistory ? <p className={styles.description}>
          La referencia se extiende fuera de las fechas con movimientos del archivo. Los ceros no garantizan que el historial esté completo.
        </p> : null}
        {comparison.referencePostingCount === 0 ? <p className={styles.description}>No hay movimientos no anulados en la referencia con estos filtros.</p> : null}
        <section aria-label="Indicadores destacados" className={styles.highlightSection}>
          <ul className={styles.highlights}>
            {highlighted.map((metric) => (
              <li className={styles.highlight} key={metric.key}>
                <h3 className={styles.highlightTitle}>{metric.label}</h3>
                <dl className={styles.highlightValues}>
                  <div><dt>Actual</dt><dd>{formatEuroMinor(metric.currentEurMinor)}</dd></div>
                  <div><dt>Referencia</dt><dd>{formatEuroMinor(metric.referenceEurMinor)}</dd></div>
                  <div><dt>Diferencia</dt><dd>{formatDelta(metric.deltaEurMinor)}</dd></div>
                  <div><dt>Variación</dt><dd>{formatVariation(metric.deltaPercent)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
        <details className={styles.curveDisclosure} onToggle={(event) => setCategoriesOpen(event.currentTarget.open)} open={categoriesOpen}>
          <summary className={styles.curveSummary}>Contribuciones por categoría</summary>
          {outerOpen && categoriesOpen ? <section aria-label="Contribuciones por categoría" className={`${styles.curveContent} ${styles.categoryDetail}`}>
            <p className={styles.description}>Desglose del gasto neto seleccionado por categoría principal, incluidas devoluciones y contrapartidas. Ver apuntes cambia el periodo global y recalcula la comparación.</p>
            {filtered.filters.categoryPrefixes.length > 0 && (filtered.filters.categoryMode === "exclude" || filtered.filters.categoryMatch === "either")
              ? <p className={styles.description}>La combinación actual de categorías no permite abrir este detalle sin ampliar la selección.</p> : null}
            <ul className={styles.highlights}>
              {comparison.categoryContributions?.map((row) => {
                const label = row.path.length === 0 ? "Sin categoría (sin asignar)" : row.name;
                const current = categoryComparisonFilters(filtered.filters, row.path, comparison.currentRange);
                const reference = categoryComparisonFilters(filtered.filters, row.path, comparison.referenceRange);
                return <li key={row.id} className={styles.highlight}>
                  <h3 className={styles.highlightTitle}>{label}</h3>
                  <dl className={styles.highlightValues}>
                    <div><dt>Actual</dt><dd>{row.currentPostingCount === 0 ? "Sin apuntes" : formatEuroMinor(row.currentEurMinor)}</dd></div>
                    <div><dt>Referencia</dt><dd>{row.referencePostingCount === 0 ? "Sin apuntes" : formatEuroMinor(row.referenceEurMinor)}</dd></div>
                    <div><dt>Diferencia</dt><dd>{formatDelta(row.deltaEurMinor)}</dd></div>
                  </dl>
                  <div className={styles.categoryActions}>
                    <Button aria-label={`Ver apuntes actuales de ${label}`} disabled={searchPending || !onViewCategory || current === null || row.currentPostingCount === 0}
                      onClick={() => { if (!searchPending && current !== null) onViewCategory?.(current); }}>Ver actual</Button>
                    <Button aria-label={`Ver apuntes de referencia de ${label}`} disabled={searchPending || !onViewCategory || reference === null || row.referencePostingCount === 0}
                      onClick={() => { if (!searchPending && reference !== null) onViewCategory?.(reference); }}>Ver referencia</Button>
                  </div>
                </li>;
              })}
            </ul>
            {comparison.categoryContributions?.length === 0 ? <p className={styles.description}>No hay apuntes en ninguno de los dos periodos con estos filtros.</p> : null}
            <p className={styles.description}>Diferencia total: {formatDelta(comparison.metrics.find((metric) => metric.key === "expenses")!.deltaEurMinor)}. Sin apuntes no significa que el historial esté completo.</p>
          </section> : null}
        </details>
        <details className={styles.curveDisclosure} onToggle={(event) => setCurveOpen(event.currentTarget.open)} open={curveOpen}>
          <summary className={styles.curveSummary}>Actividad registrada acumulada</summary>
          {outerOpen && curveOpen ? <CumulativeCurve comparison={comparison} filtered={filtered} /> : null}
        </details>
        <details className={styles.allStatistics}>
          <summary className={styles.allStatisticsSummary}>Todas las estadísticas</summary>
          <div className={styles.allStatisticsContent}>
            <DataTable caption="Importes del periodo actual frente a la referencia" columns={columns} rowKey={(metric) => metric.key} rows={comparison.metrics} />
            <p className={styles.description}>
              Diferencia = actual − referencia. El porcentaje usa el valor absoluto de referencia; con base cero no se calcula.
              {" "}Las entradas y salidas incluyen transferencias entre las cuentas seleccionadas; no son ingresos ni gastos por sí solas.
            </p>
            <p className={styles.description}>
              Las estadísticas de deuda usan las cuentas de deuda incluidas en el ámbito y la selección.
              {" "}El saldo final completo se mide al final de cada rango y conserva todo el historial de esas cuentas, aunque filtres categorías, origen, destino, etiquetas o búsqueda.
              {" "}Las contrapartidas muestran ajustes contables de transferencias verificadas; no son devoluciones cobradas.
            </p>
          </div>
        </details>
      </> : mode !== "none" && !invalidRange ? <p className={styles.description}>
        {mode === "custom" ? "Completa las dos fechas de referencia." : "Selecciona un periodo con fechas para comparar."}
      </p> : null}
      </section>
    </details>
  );
}
