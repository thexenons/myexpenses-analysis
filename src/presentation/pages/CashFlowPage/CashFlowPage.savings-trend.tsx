import { useMemo } from "react";

import { isoDateInTimeZone } from "../../../domain/analytics/date-periods.ts";
import { analyzeMonthlySavingsRate, type MonthlySavingsRatePoint } from "../../../domain/analytics/savings-rate.ts";
import type { FilteredAnalyticsDataset } from "../../../domain/analytics/types.ts";
import { DataTable } from "../../components/organisms/DataTable/index.ts";
import type { DataTableColumn } from "../../components/organisms/DataTable/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { formatDate, formatEuroMinor, formatPeriodLabel } from "../../utils/format.ts";
import styles from "./CashFlowPage.module.css";

const percentFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const formatPercent = (value: number) => `${percentFormatter.format(value)} %`;
const columns: readonly DataTableColumn<MonthlySavingsRatePoint>[] = [
  { key: "month", header: "Mes", cell: (point) => formatPeriodLabel(point.key), rowHeader: true },
  { key: "income", header: "Ingreso neto", cell: (point) => formatEuroMinor(point.incomeEurMinor), align: "end" },
  { key: "expenses", header: "Gasto neto", cell: (point) => formatEuroMinor(point.expensesEurMinor), align: "end" },
  { key: "result", header: "Resultado contable", cell: (point) => formatEuroMinor(point.resultEurMinor), align: "end" },
  { key: "rate", header: "Tasa", cell: (point) => point.ratePercent === null ? "Sin base" : formatPercent(point.ratePercent), align: "end" },
];

export function MonthlySavingsTrend({ filtered }: { readonly filtered: FilteredAnalyticsDataset }) {
  const result = useMemo(() => analyzeMonthlySavingsRate(
    filtered,
    isoDateInTimeZone(new Date(), filtered.source.backup?.preferences.timeZone ?? "Europe/Madrid"),
  ), [filtered]);
  if (result.status === "unavailable") return <div className={styles.savingsTrendBody}>
    <p>{result.reason === "subset"
      ? "No disponible con esta perspectiva o con filtros de cuentas o contenido. Selecciona Yo sin esos filtros para interpretar la tasa contable."
      : "No hay meses calendario completos dentro del período seleccionado y las fechas observadas."}</p>
    <p>Las fechas observadas no garantizan que el historial registrado esté completo.</p>
  </div>;

  const plotted = result.months.filter((month) => month.ratePercent !== null);
  return <div className={styles.savingsTrendBody}>
    <p>Resultado contable mensual = ingreso neto + gasto neto; tasa = resultado / ingreso neto positivo. No incluye transferencias en el resultado, no se limita a 0–100 % y no representa efectivo disponible ni patrimonio.</p>
    <p>Solo meses calendario completos dentro de las fechas observadas y del período seleccionado. Se muestra actividad registrada; esas fechas no garantizan un historial completo. Los meses sin ingreso neto positivo figuran sin base.</p>
    {plotted.length > 0 ? <LineChart
      className={styles.savingsTrendChart}
      description="Tasa contable mensual de la perspectiva Yo. La línea une solo meses con base; no representa los meses intermedios sin base. Consulta la tabla para todos los importes."
      formatLabel={formatPeriodLabel}
      formatValue={formatPercent}
      series={[{ id: "rate", label: "Tasa de ahorro contable", data: plotted.map((month) => ({
        label: month.key,
        value: month.ratePercent!,
        tooltip: `${formatDate(month.startDate)} – ${formatDate(month.endDate)} · ${formatPercent(month.ratePercent!)} · resultado ${formatEuroMinor(month.resultEurMinor)}`,
      })) }]}
      title="Tasa mensual de ahorro contable"
    /> : <p>No hay ingresos netos positivos en los meses completos para dibujar una tasa.</p>}
    <DataTable caption="Detalle mensual del ahorro contable" columns={columns} rowKey={(month) => month.key} rows={result.months} />
  </div>;
}
