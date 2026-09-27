import { Panel } from "../../components/molecules/Panel/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { formatEuroMinor } from "../../utils/format.ts";
import type { PerspectiveComparisonRow } from "./PerspectiveComparisonPage.helpers.ts";
import styles from "./PerspectiveComparisonPage.module.css";

interface PerspectiveComparisonPageViewProps {
  readonly rows: readonly PerspectiveComparisonRow[];
  readonly searchPending: boolean;
}

const METRICS = [
  { label: "Ingresos", field: "incomesEurMinor" },
  { label: "Gastos", field: "expensesEurMinor" },
  { label: "Transferencias", field: "transfersEurMinor" },
  { label: "Movimiento neto", field: "netEurMinor" },
] as const;

const SCOPE_LABELS = {
  realCashFlow: "Flujo real",
  all: "Yo",
  debtsOnly: "Deudas",
} as const;

export function PerspectiveComparisonPageView({
  rows,
  searchPending,
}: PerspectiveComparisonPageViewProps) {
  const isEmpty = rows.every((row) => row.postingCount === 0);

  return (
    <AnalyticsPage
      description="Tres lecturas del mismo periodo. Los demás filtros globales se aplican a cada perspectiva; el selector de ámbito no oculta ninguna columna."
      notice={searchPending ? "Actualizando búsqueda…" : undefined}
      title="Comparativa de perspectivas"
    >
      <div className={styles.summary}>
        {rows.map((row) => (
          <article className={styles.summaryItem} key={row.scope}>
            <h2 className={styles.summaryLabel}>{SCOPE_LABELS[row.scope]}</h2>
            <data className={styles.summaryValue} value={row.netEurMinor / 100}>
              {formatEuroMinor(row.netEurMinor)}
            </data>
            <p className={styles.summaryDetail}>
              Movimiento neto · {row.postingCount} {row.postingCount === 1 ? "movimiento" : "movimientos"}
            </p>
          </article>
        ))}
      </div>

      <Panel
        description="Importes con signo: los abonos reducen el gasto y las transferencias conservan su dirección."
        title="Desglose del periodo"
      >
        {isEmpty ? (
          <p className={styles.empty}>
            No hay movimientos en el periodo con los filtros aplicados.
          </p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption>Comparación de movimientos por perspectiva</caption>
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                {rows.map((row) => (
                  <th key={row.scope} scope="col">{SCOPE_LABELS[row.scope]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(({ label, field }) => (
                <tr className={field === "netEurMinor" ? styles.netRow : undefined} key={field}>
                  <th scope="row">{label}</th>
                  {rows.map((row) => (
                    <td key={row.scope}>{formatEuroMinor(row[field])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className={styles.explanation}>
        Yo reúne los movimientos de Flujo real y Deudas. El movimiento neto en Deudas no es gasto atribuido ni saldo; muestra solo entradas y salidas de las cuentas de deuda seleccionadas.
      </p>
    </AnalyticsPage>
  );
}
