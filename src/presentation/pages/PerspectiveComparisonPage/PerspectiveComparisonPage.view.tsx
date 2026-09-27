import { useState } from "react";

import { Panel } from "../../components/molecules/Panel/index.ts";
import { AccordionTree, AccordionTreeItem } from "../../components/organisms/AccordionTree/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { formatCategoryPath, formatEuroMinor } from "../../utils/format.ts";
import type {
  CategoryMetric,
  PerspectiveCategoryRow,
  PerspectiveComparisonRow,
} from "./PerspectiveComparisonPage.helpers.ts";
import styles from "./PerspectiveComparisonPage.module.css";

interface PerspectiveComparisonPageViewProps {
  readonly rows: readonly PerspectiveComparisonRow[];
  readonly categories: readonly PerspectiveCategoryRow[];
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

const CATEGORY_METRICS: readonly { value: CategoryMetric; label: string }[] = [
  { value: "netEurMinor", label: "Movimiento neto" },
  { value: "incomesEurMinor", label: "Ingresos" },
  { value: "expensesEurMinor", label: "Gastos" },
  { value: "transfersEurMinor", label: "Transferencias" },
];

function ComparisonCategoryNode({
  category,
  depth,
  metric,
}: {
  readonly category: PerspectiveCategoryRow;
  readonly depth: number;
  readonly metric: CategoryMetric;
}) {
  const label = category.path.length === 0
    ? "Sin categoría (sin asignar)"
    : formatCategoryPath(category.path);
  return (
    <AccordionTreeItem
      header={
        <>
          <span className={styles.categoryName}>{label}</span>
          <dl className={styles.categoryValues}>
            {(["realCashFlow", "all", "debtsOnly"] as const).map((scope) => (
              <div className={styles.categoryValue} key={scope}>
                <dt>{SCOPE_LABELS[scope]}</dt>
                <dd>{formatEuroMinor(category.amounts[scope][metric])}</dd>
              </div>
            ))}
          </dl>
        </>
      }
      initialExpanded={depth === 0}
      label={label}
      rowClassName={styles.categoryRow}
    >
      {category.children.map((child) => (
        <ComparisonCategoryNode category={child} depth={depth + 1} key={child.id} metric={metric} />
      ))}
    </AccordionTreeItem>
  );
}

export function PerspectiveComparisonPageView({
  rows,
  categories,
  searchPending,
}: PerspectiveComparisonPageViewProps) {
  const isEmpty = rows.every((row) => row.postingCount === 0);
  const [categoryMetric, setCategoryMetric] = useState<CategoryMetric>("netEurMinor");

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
      <Panel
        description="Despliega todas las rutas con actividad. Cada importe incluye los apuntes directos de esa categoría y sus descendientes; no sumes padres e hijos entre sí. Este árbol no modifica los filtros."
        title="Categorías por perspectiva"
      >
        <label className={styles.categoryControl}>
          Métrica de categorías
          <select
            onChange={(event) => setCategoryMetric(event.target.value as CategoryMetric)}
            value={categoryMetric}
          >
            {CATEGORY_METRICS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {categories.length === 0 ? (
          <p className={styles.empty}>No hay categorías con actividad para los filtros aplicados.</p>
        ) : (
          <AccordionTree aria-label="Categorías comparadas">
            {categories.map((category) => (
              <ComparisonCategoryNode category={category} depth={0} key={category.id} metric={categoryMetric} />
            ))}
          </AccordionTree>
        )}
      </Panel>
      <p className={styles.explanation}>
        Yo reúne los movimientos de Flujo real y Deudas. El movimiento neto en Deudas no es gasto atribuido ni saldo; muestra solo entradas y salidas de las cuentas de deuda seleccionadas.
      </p>
    </AnalyticsPage>
  );
}
