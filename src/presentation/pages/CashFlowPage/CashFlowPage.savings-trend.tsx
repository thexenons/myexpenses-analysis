import { useMemo } from "react";

import { useToday } from "../../hooks/use-today.ts";
import { analyzeMonthlySavingsRate, type MonthlySavingsRatePoint } from "../../../domain/analytics/savings-rate.ts";
import type { FilteredAnalyticsDataset } from "../../../domain/analytics/types.ts";
import { DataTable } from "../../components/organisms/DataTable/index.ts";
import type { DataTableColumn } from "../../components/organisms/DataTable/index.ts";
import { InformationDisclosure } from "../../components/molecules/InformationDisclosure/InformationDisclosure.tsx";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { formatDate, formatEuroMinor, formatPeriodLabel } from "../../utils/format.ts";
import styles from "./CashFlowPage.module.css";

const percentFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const formatPercent = (value: number) => `${percentFormatter.format(value)} %`;
const accountingColumns: readonly DataTableColumn<MonthlySavingsRatePoint>[] = [
  { key: "month", header: "Mes", cell: (point) => formatPeriodLabel(point.key), rowHeader: true },
  { key: "income", header: "Ingreso neto", cell: (point) => formatEuroMinor(point.incomeEurMinor), align: "end" },
  { key: "expenses", header: "Gasto neto", cell: (point) => formatEuroMinor(point.expensesEurMinor), align: "end" },
  { key: "result", header: "Resultado contable", cell: (point) => formatEuroMinor(point.resultEurMinor), align: "end" },
  { key: "rate", header: "Tasa", cell: (point) => point.ratePercent === null ? "Sin base" : formatPercent(point.ratePercent), align: "end" },
];
const retentionColumns: readonly DataTableColumn<MonthlySavingsRatePoint>[] = [
  { key: "month", header: "Mes", cell: (point) => formatPeriodLabel(point.key), rowHeader: true },
  { key: "entries", header: "Entradas reales (base)", cell: (point) => formatEuroMinor(point.cashEntriesEurMinor ?? 0), align: "end" },
  { key: "variation", header: "Variación de efectivo", cell: (point) => formatEuroMinor(point.resultEurMinor), align: "end" },
  { key: "rate", header: "Tasa de retención", cell: (point) => point.ratePercent === null ? "Sin base" : formatPercent(point.ratePercent), align: "end" },
];
const debtColumns: readonly DataTableColumn<MonthlySavingsRatePoint>[] = [
  { key: "month", header: "Mes", cell: (point) => formatPeriodLabel(point.key), rowHeader: true },
  { key: "variation", header: "Variación contable", cell: (point) => formatEuroMinor(point.resultEurMinor), align: "end" },
];

export function MonthlySavingsTrend({ filtered }: { readonly filtered: FilteredAnalyticsDataset }) {
  const today = useToday(filtered.source.backup?.preferences.timeZone ?? "Europe/Madrid");
  const result = useMemo(() => analyzeMonthlySavingsRate(
    filtered,
    today,
  ), [filtered, today]);
  if (result.status === "unavailable") return <div className={styles.savingsTrendBody}>
    <p>{result.reason === "subset"
      ? "No disponible con filtros de cuentas o contenido. Quita esos filtros para interpretar la tendencia mensual."
      : "No hay meses calendario completos dentro del período seleccionado y las fechas observadas."}</p>
    <p>Las fechas observadas no garantizan que el historial registrado esté completo.</p>
  </div>;

  const isDebt = result.mode === "debtsOnly";
  const isReal = result.mode === "realCashFlow";
  const plotted = isDebt ? result.months : result.months.filter((month) => month.ratePercent !== null);
  const title = isDebt ? "Variación mensual de deudas" : isReal
    ? "Tasa mensual de retención de efectivo" : "Tasa mensual de ahorro contable";
  const caption = isDebt ? "Detalle mensual de variación de deudas" : isReal
    ? "Detalle mensual de retención de efectivo" : "Detalle mensual del ahorro contable";
  return <div className={styles.savingsTrendBody}>
    {isDebt ? <p>Los saldos contables no implican importes recuperables.</p> : null}
    <p>Solo meses calendario completos dentro del período y las fechas observadas. Se muestra actividad registrada; esas fechas no garantizan un historial completo.</p>
    {plotted.length > 0 ? <LineChart
      className={styles.savingsTrendChart}
      description={isDebt
        ? "Variación contable mensual registrada de la perspectiva Deudas, en euros. Consulta la tabla para los importes exactos."
        : `${isReal ? "Retención de efectivo" : "Ahorro contable"} mensual en porcentaje. La línea une solo meses con base; no representa los meses intermedios sin base. Consulta la tabla para todos los importes.`}
      formatLabel={formatPeriodLabel}
      formatValue={isDebt ? formatEuroMinor : formatPercent}
      series={[{ id: "trend", label: title, data: plotted.map((month) => ({
        label: month.key,
        value: isDebt ? month.resultEurMinor : month.ratePercent!,
        tooltip: `${formatDate(month.startDate)} – ${formatDate(month.endDate)} · ${isDebt ? formatEuroMinor(month.resultEurMinor) : formatPercent(month.ratePercent!)} · ${isReal ? "variación de efectivo" : isDebt ? "variación contable" : "resultado contable"} ${formatEuroMinor(month.resultEurMinor)}`,
      })) }]}
      title={title}
    /> : <p>No hay base positiva en los meses completos para dibujar una tasa.</p>}
    <DataTable caption={caption} columns={isDebt ? debtColumns : isReal ? retentionColumns : accountingColumns} rowKey={(month) => month.key} rows={result.months} />
    <InformationDisclosure label="Información de la tendencia mensual">
      {isDebt ? <p>La variación contable es el movimiento neto registrado en cuentas de deuda. Puede reflejar asignaciones o cargos; no presupone devolución, ingreso ni patrimonio recuperable.</p>
        : isReal ? <p>La retención de efectivo divide la variación real firmada entre las entradas positivas registradas en cuentas operativas, excluyendo transferencias internas verificadas entre ellas. La base incluye devoluciones, financiación y pagos recibidos cuando constan; no presume pagos futuros. No es beneficio ni patrimonio.</p>
          : <p>El ahorro contable es ingreso neto más gasto neto firmado, sin transferencias. La tasa divide ese resultado entre ingreso neto positivo; no equivale a efectivo disponible ni patrimonio.</p>}
      {!isDebt ? <p>La tasa conserva valores negativos o superiores al 100 %. Los meses sin base positiva figuran «Sin base»; la línea omite esos puntos.</p> : null}
    </InformationDisclosure>
  </div>;
}
