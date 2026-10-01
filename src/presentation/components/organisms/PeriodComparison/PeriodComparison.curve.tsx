import { useMemo, useState } from "react";

import { buildCumulativeComparison, type CumulativeComparisonMetric } from "../../../../domain/analytics/comparison-cumulative.ts";
import type { PeriodComparisonResult } from "../../../../domain/analytics/comparison.ts";
import type { FilteredAnalyticsDataset } from "../../../../domain/analytics/types.ts";
import { formatDate, formatEuroMinor } from "../../../utils/format.ts";
import { LineChart } from "../LineChart/index.ts";
import styles from "./PeriodComparison.module.css";

export function CumulativeCurve({ filtered, comparison }: { filtered: FilteredAnalyticsDataset; comparison: PeriodComparisonResult }) {
  const [metric, setMetric] = useState<CumulativeComparisonMetric>("expenses");
  const curve = useMemo(() => buildCumulativeComparison(filtered, comparison, metric), [filtered, comparison, metric]);
  const series = curve === null ? [] : [
    { id: "current", label: "Actual", data: curve.current.map((point) => ({
      label: `Día ${point.day}`,
      value: point.eurMinor,
      tooltip: `${formatDate(point.date)} · ${formatEuroMinor(point.eurMinor)}`,
    })) },
    { id: "reference", label: "Referencia", data: curve.reference.map((point) => ({
      label: `Día ${point.day}`,
      value: point.eurMinor,
      tooltip: `${formatDate(point.date)} · ${formatEuroMinor(point.eurMinor)}`,
    })) },
  ];
  return <div className={styles.curveContent}>
    <label className={styles.field}>
      <span>Estadística de la curva</span>
      <select onChange={(event) => setMetric(event.currentTarget.value as CumulativeComparisonMetric)} value={metric}>
        <option value="expenses">Gasto neto seleccionado</option>
        <option value="income">Ingreso neto seleccionado</option>
        <option value="net">Neto seleccionado</option>
      </select>
    </label>
    <p className={styles.description}>Acumulado por día transcurrido de actividad registrada, no saldo disponible ni garantía de historial completo. Consulta cada punto para ver su fecha real.</p>
    {curve?.sampled ? <p className={styles.description}>Rango largo: se muestran hitos muestreados; cada importe incluye todos los movimientos registrados hasta ese día.</p> : null}
    {curve === null ? <p className={styles.description}>No se puede representar esta comparación de forma segura.</p> :
      <LineChart
        description="Actividad registrada acumulada por día transcurrido. Actual y referencia conservan su fecha final real; los importes incluyen los mismos filtros y ajustes contables que las estadísticas seleccionadas."
        formatValue={formatEuroMinor}
        series={series}
        title="Actividad registrada acumulada"
      />}
  </div>;
}
