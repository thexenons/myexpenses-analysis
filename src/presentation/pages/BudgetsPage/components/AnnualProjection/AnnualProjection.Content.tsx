import type { AnnualProjectionResult } from "../../../../../domain/analytics/annual-projection.ts";
import { LineChart } from "../../../../components/organisms/LineChart/index.ts";
import type { ChartSeries } from "../../../../components/organisms/LineChart/index.ts";
import { TableScrollRegion } from "../../../../components/organisms/TableScrollRegion/TableScrollRegion.tsx";
import { formatDate, formatEuroMinor, formatPeriodLabel } from "../../../../utils/format.ts";
import styles from "./AnnualProjection.module.css";

type ReadyProjection = Extract<AnnualProjectionResult, { status: "ready" }>;

function projectionSeries(result: ReadyProjection): readonly ChartSeries[] {
  const data = result.points.map((point) => ({
    label: point.key,
    value: point.cumulativeEurMinor,
    tooltip: `${formatDate(point.endDate)} · ${point.kind === "actual" ? "Real" : "Estimado"} · ` +
      `aporte ${formatEuroMinor(point.monthlyContributionEurMinor)} · acumulado ${formatEuroMinor(point.cumulativeEurMinor)}`,
  }));
  const actual = data.filter((_, index) => result.points[index]?.kind === "actual");
  if (actual.length === data.length) return [{ id: "actual", label: "Flujo real acumulado", color: "#286a4c", data }];
  return [
    { id: "trajectory", label: "Trayectoria real y estimada", color: "#35698b", data },
    ...(actual.length > 0 ? [{ id: "actual", label: "Tramo real", color: "#286a4c", data: actual }] : []),
  ];
}

export function AnnualProjectionContent({ result }: { result: ReadyProjection }) {
  const december = result.points[11];
  const allActual = result.points.every((point) => point.kind === "actual");
  return (
    <div className={styles.content}>
      <p className={styles.total}>Diciembre: <strong>{formatEuroMinor(december!.cumulativeEurMinor)}</strong></p>
      <p className={styles.subtitle}>Ahorro o déficit neto acumulado desde enero; no es saldo inicial ni patrimonio.</p>
      <LineChart
        description={allActual
          ? "Doce cierres mensuales de flujo real acumulado. Consulta la tabla de datos exactos y el desglose mensual."
          : "Trayectoria acumulada: el tramo verde identifica meses reales y el resto es estimado. Cada punto conserva su tipo, aporte y acumulado en el desglose mensual."}
        formatLabel={formatPeriodLabel}
        formatValue={formatEuroMinor}
        series={projectionSeries(result)}
        title={`Ahorro acumulado en ${result.year}`}
      />
      <div className={styles.assumptions}>
        <p>Año natural completo de {result.year}: sustituye el intervalo de fechas seleccionado. Los meses cerrados con cobertura completa usan el flujo real registrado. Fecha de {result.dateBasis === "value" ? "valor (operación si falta)" : "operación"}.</p>
        {allActual ? (
          <p>{result.income.completeMonthCount} meses completos; todos los puntos son reales y no se necesita estimar ingresos.</p>
        ) : (
          <p>Ingresos estimados: media de {result.income.completeMonthCount} {result.income.completeMonthCount === 1 ? "mes completo" : "meses completos"} del mismo año ({formatEuroMinor(result.income.expectedMonthlyMinor!)} al mes). En meses incompletos o futuros se resta el presupuesto mensual completo. Lo ya cobrado fija el mínimo del ingreso total estimado: no se suma dos veces.</p>
        )}
        {result.budget.grouping === "MONTH" ? (
          <p>Presupuesto mensual: se resuelve la asignación global de cada mes natural según su etiqueta; las categorías no se suman de nuevo.</p>
        ) : (
          <p>Presupuesto anual: {formatEuroMinor(result.budget.annualBudgetMinor)} repartidos de forma uniforme entre 12 meses naturales, incluidos los céntimos restantes. Es una referencia de reparto, no un calendario de gasto.</p>
        )}
      </div>
      <details className={styles.details}>
        <summary>Desglose mensual</summary>
        <TableScrollRegion className={styles.scroller} label="Tabla desplazable: aportes y acumulado por mes">
          <table className={styles.table}>
            <caption>Aportes y acumulado por mes</caption>
            <thead><tr><th scope="col">Mes</th><th scope="col">Tipo</th><th scope="col">Aporte mensual</th><th scope="col">Acumulado</th></tr></thead>
            <tbody>
              {result.points.map((point) => (
                <tr key={point.key}>
                  <th scope="row">{point.key}</th>
                  <td>{point.kind === "actual" ? "Real" : "Estimado"}</td>
                  <td>{formatEuroMinor(point.monthlyContributionEurMinor)}</td>
                  <td>{formatEuroMinor(point.cumulativeEurMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollRegion>
      </details>
    </div>
  );
}
