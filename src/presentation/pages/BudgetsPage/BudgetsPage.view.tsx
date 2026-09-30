import { useState } from "react";

import { budgetContributionsForPath } from "../../../domain/analytics/budgets.ts";
import { EmptyState } from "../../components/molecules/EmptyState/EmptyState.tsx";
import { Icon } from "../../components/atoms/Icon/Icon.tsx";
import { KpiCard } from "../../components/molecules/KpiCard/KpiCard.tsx";
import { Panel } from "../../components/molecules/Panel/Panel.tsx";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/AnalyticsPage.tsx";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/AnalyticsPageGrid.tsx";
import {
  budgetAmountFormatter,
  budgetMinorToMajor,
  formatBudgetMinor,
} from "./BudgetsPage.helpers.ts";
import type { BudgetsPageViewProps } from "./BudgetsPage.types.ts";
import { BudgetAllocationTable } from "./components/BudgetAllocationTable/BudgetAllocationTable.tsx";
import { BudgetConsumptionDialog } from "./components/BudgetConsumptionDialog/BudgetConsumptionDialog.tsx";
import { BudgetControls } from "./components/BudgetControls/BudgetControls.tsx";
import { BudgetReferenceControls } from "./components/BudgetReferenceControls/BudgetReferenceControls.tsx";
import { BudgetUtilization } from "./components/BudgetUtilization/BudgetUtilization.tsx";
import styles from "./BudgetsPage.module.css";
import { formatCount, formatDate } from "../../utils/format.ts";
import { formatBudgetComparisonDelta } from "./BudgetsPage.helpers.ts";
import type { BudgetPeriodMean } from "../../../domain/analytics/budget-period-comparison.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

function filterSummaryLabel(
  summary: NonNullable<BudgetsPageViewProps["analysis"]>["filterSummary"],
): string {
  if (summary === null) return "No configurado";
  const accounts = `${summary.accountCount} ${summary.accountCount === 1 ? "cuenta" : "cuentas"}`;
  const categories = `${summary.categoryCount} ${summary.categoryCount === 1 ? "categoría" : "categorías"}`;
  return `${summary.rootOperator} · ${accounts} · ${categories}`;
}

const meanUnitLabels = {
  DAY: ["día", "días"], WEEK: ["semana", "semanas"],
  MONTH: ["mes", "meses"], YEAR: ["año", "años"],
  NONE: ["intervalo", "intervalos"],
} as const;

function meanContext(mean: BudgetPeriodMean): string {
  if (mean.status === "unsupported-grouping") return "Media no disponible: el intervalo libre no tiene una unidad comparable.";
  if (mean.status === "no-complete-history") return "Media no disponible: no hay periodos anteriores completos en el historial.";
  const unit = meanUnitLabels[mean.unit ?? "NONE"];
  return `${mean.periodCount} ${mean.periodCount === 1 ? unit[0] : unit[1]} ${mean.periodCount === 1 ? "completo" : "completos"} (${formatDate(mean.firstDate!)} – ${formatDate(mean.lastDate!)}).`;
}

export function BudgetsPageView({
  analysis,
  comparison = null,
  comparisonError = null,
  budgetOptions,
  dataset,
  emptyDescription,
  emptyTitle,
  onBudgetChange,
  onPeriodChange,
  onReferenceAdd,
  onReferenceRemove,
  onPrimaryReferenceChange,
  periodOptions,
  searchPending,
  selectedBudgetUuid,
  selectedPeriodKey,
}: BudgetsPageViewProps) {
  const [detail, setDetail] = useState<{
    title: string;
    path: readonly string[] | null;
    trigger: HTMLButtonElement;
  } | null>(null);
  const controls =
    budgetOptions.length === 0 ? null : (
      <BudgetControls
        budgets={budgetOptions}
        onBudgetChange={onBudgetChange}
        onPeriodChange={onPeriodChange}
        periods={periodOptions}
        selectedBudgetUuid={selectedBudgetUuid}
        selectedPeriodKey={selectedPeriodKey}
      />
    );

  if (analysis === null) {
    return (
      <AnalyticsPage
        description="Compara límites planificados con el gasto neto real, sin convertir la fila técnica global en una categoría ficticia."
        eyebrow="Planificación financiera"
        notice={searchPending ? "Actualizando filtros…" : undefined}
        title="Presupuestos"
      >
        {controls === null ? null : (
          <Panel title="Selección" description="Elige la definición que quieres revisar">
            {controls}
          </Panel>
        )}
        <Panel>
          <EmptyState
            description={emptyDescription ?? "No hay datos disponibles."}
            headingLevel={2}
            icon={<Icon name="calendar" />}
            title={emptyTitle ?? "Presupuesto no disponible"}
          />
        </Panel>
      </AnalyticsPage>
    );
  }

  const { fractionDigits, currency, global } = analysis;
  const primaryReference = comparison?.references.find((reference) => reference.range.key === comparison.primaryReferenceKey);
  const primaryIncome = comparison?.income.references.find((reference) => reference.referenceKey === comparison.primaryReferenceKey);
  const primaryElapsed = comparison?.elapsed?.references.find((reference) => reference.referenceKey === comparison.primaryReferenceKey);
  const amountFormatter = budgetAmountFormatter(currency, fractionDigits);
  const toMajor = (amountMinor: number) =>
    budgetMinorToMajor(amountMinor, fractionDigits);

  return (
    <AnalyticsPage
      description="Límites, gasto neto y disponibilidad del periodo. Los importes reales ya incorporan los filtros globales y sólo después se cruzan con las fechas del presupuesto."
      eyebrow="Planificación financiera"
      notice={searchPending ? "Actualizando filtros…" : undefined}
      title="Presupuestos"
    >
      <Panel
        className={styles.controlsPanel}
        description="La selección es local a esta vista. El filtro guardado por el presupuesto se combina con cuentas, categorías y búsqueda globales."
        title="Marco de análisis"
      >
        {controls}
        <p className={styles.technicalNote}>
          Fecha de {analysis.dateBasis === "value" ? "valor; se usa operación cuando no está registrada" : "operación"}.
          {" "}{analysis.consumptionDateRange === null
            ? "No hay solapamiento entre las fechas globales y el periodo del presupuesto."
            : `Consumo consultado: ${formatDate(analysis.consumptionDateRange?.from ?? analysis.period.startDate)} – ${formatDate(analysis.consumptionDateRange?.to ?? analysis.period.endDate)}.`}
          {" "}Las asignaciones y los arrastres corresponden al periodo completo, sin prorratear.
          {analysis.isFilteredComparison ? " Con filtros, asignado menos corte y utilización comparan ese límite completo con el gasto seleccionado; no indican la disponibilidad real del presupuesto completo." : ""}
        </p>
      </Panel>

      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail={`Base ${formatBudgetMinor(global.baseMinor, currency, fractionDigits)}`}
          formatValue={amountFormatter}
          icon={<Icon name="wallet" />}
          label="Asignado global"
          tone="cash"
          value={toMajor(global.assignedMinor)}
        />
        <KpiCard
          detail={
            <>
              Neto de los apuntes seleccionados
              <button
                aria-label="Ver apuntes del gasto neto"
                className={styles.inspectButton}
                onClick={(event) => setDetail({ title: "Gasto neto", path: null, trigger: event.currentTarget })}
                type="button"
              >
                Ver apuntes
              </button>
            </>
          }
          formatValue={amountFormatter}
          icon={<Icon name="receipt" />}
          label="Gasto neto"
          tone={global.consumedMinor > global.assignedMinor ? "negative" : "warning"}
          value={toMajor(global.consumedMinor)}
        />
        <KpiCard
          detail={formatCount(analysis.filteredPostingCount, "apunte efectivo", "apuntes efectivos")}
          formatValue={amountFormatter}
          icon={<Icon name="trend" />}
          label={analysis.isFilteredComparison ? "Asignado menos corte" : "Disponible"}
          tone={analysis.isFilteredComparison ? "info" : global.availableMinor < 0 ? "negative" : "positive"}
          value={toMajor(global.availableMinor)}
        />
        <KpiCard
          detail={analysis.period.label}
          emptyValue="Sin límite global"
          formatValue={percentageFormatter}
          icon={<Icon name="calendar" />}
          label="Utilización"
          tone={
            global.health === "exceeded"
              ? "negative"
              : global.health === "watch"
                ? "warning"
                : "info"
          }
          value={global.utilization}
        />
      </AnalyticsPageGrid>

      <Panel
        className={styles.progressPanel}
        description={`${analysis.period.startDate} — ${analysis.period.endDate}`}
        title={`${analysis.budget.title} · ${analysis.period.label}`}
      >
        <div className={styles.progressLayout}>
          <BudgetUtilization
            health={analysis.isFilteredComparison ? "unallocated" : global.health}
            label={analysis.isFilteredComparison ? "Utilización del corte filtrado" : "Ritmo de consumo global"}
            utilization={global.utilization}
            variant="hero"
          />
          <dl className={styles.ledger}>
            <div>
              <dt>Asignaciones categorizadas</dt>
              <dd>
                {formatBudgetMinor(
                  analysis.categoryAssignedMinor,
                  currency,
                  fractionDigits,
                )}
              </dd>
            </div>
            <div>
              <dt>Consumo sin asignación</dt>
              <dd>
                {formatBudgetMinor(
                  analysis.unallocatedConsumedMinor,
                  currency,
                  fractionDigits,
                )}
              </dd>
            </div>
            <div>
              <dt>Arrastre recibido</dt>
              <dd>
                {formatBudgetMinor(
                  global.rolloverPreviousMinor,
                  currency,
                  fractionDigits,
                )}
              </dd>
            </div>
            <div>
              <dt>Arrastre siguiente</dt>
              <dd>
                {formatBudgetMinor(
                  global.rolloverNextMinor,
                  currency,
                  fractionDigits,
                )}
              </dd>
            </div>
            <div>
              <dt>Filtro propio</dt>
              <dd>{filterSummaryLabel(analysis.filterSummary)}</dd>
            </div>
            <div>
              <dt>Neutral agregado</dt>
              <dd>{analysis.aggregateNeutral ? "Sí" : "No"}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      <Panel
        className={styles.allocationsPanel}
        description="Un padre con asignación propia actúa como límite del subárbol; sus hijos se muestran como detalle, no se suman otra vez al total del padre."
        footer={
          <p className={styles.technicalNote}>
            La asignación global procede de la fila técnica sin categoría. Se usa
            para los KPIs, pero no se presenta como una categoría inventada.
          </p>
        }
        title="Desglose jerárquico"
      >
        {comparisonError === null ? null : <output className={styles.technicalNote}>No se ha podido calcular la comparación con los datos actuales.</output>}
        {comparison === null ? null : (
          <div className={styles.comparisonHeader}>
            {dataset.backup?.preferences === undefined || onReferenceAdd === undefined || onReferenceRemove === undefined || onPrimaryReferenceChange === undefined ? null : (
              <BudgetReferenceControls
                key={`${selectedBudgetUuid}:${selectedPeriodKey}`}
                period={analysis.period}
                preferences={dataset.backup.preferences}
                references={comparison.references}
                primaryReferenceKey={comparison.primaryReferenceKey}
                onAdd={onReferenceAdd}
                onRemove={onReferenceRemove}
                onPrimaryChange={onPrimaryReferenceChange}
              />
            )}
            <p className={styles.comparisonContext}>
              {primaryReference === undefined ? "Sin referencia principal seleccionada." :
                `Referencia principal: ${primaryReference.range.label}. Periodo completo: ${formatDate(primaryReference.range.startDate)} – ${formatDate(primaryReference.range.endDate)}${primaryReference.status === "unavailable" ? " (sin datos completos)" : ""}.`}
              {" "}{meanContext(comparison.mean)}
              {" "}Los importes de referencia y media son de periodos completos; no se prorratean con el corte actual.
            </p>
            <section aria-label="Ingresos en el mismo ámbito" className={styles.incomeComparison}>
              <div>
                <strong>Ingresos en el mismo ámbito</strong>
                <p>Apuntes de categorías de ingreso; no reducen el consumo del presupuesto.</p>
              </div>
              <dl>
                <div><dt>Actual</dt><dd>{formatBudgetMinor(comparison.income.currentMinor, currency, fractionDigits)}</dd></div>
                <div><dt>Referencia completa</dt><dd>{primaryReference === undefined ? "Sin referencia" : primaryIncome?.amountMinor === null || primaryIncome?.amountMinor === undefined ? "Sin datos" : formatBudgetMinor(primaryIncome.amountMinor, currency, fractionDigits)}</dd></div>
                <div><dt>Media</dt><dd>{comparison.mean.status !== "ready" || comparison.income.mean.averageMinor === null ? "Sin media" : formatBudgetMinor(comparison.income.mean.averageMinor, currency, fractionDigits)}</dd></div>
              </dl>
              {primaryReference === undefined ? null : (
                <p className={styles.incomeDelta}>Diferencia con la referencia: {formatBudgetComparisonDelta(primaryIncome?.deltaMinor ?? null, primaryIncome?.percentChange ?? null, currency, fractionDigits)}</p>
              )}
              {primaryElapsed === undefined ? null : (
                <details className={styles.incomeElapsed}>
                  <summary>Mismo tramo transcurrido · ingresos</summary>
                  <p>{primaryElapsed.status === "complete" ?
                    `${formatDate(primaryElapsed.currentRange!.from)} – ${formatDate(primaryElapsed.currentRange!.to)}: ${formatBudgetMinor(primaryElapsed.currentIncomeMinor!, currency, fractionDigits)} / ${formatDate(primaryElapsed.referenceRange!.from)} – ${formatDate(primaryElapsed.referenceRange!.to)}: ${formatBudgetMinor(primaryElapsed.referenceIncomeMinor!, currency, fractionDigits)} · ${formatBudgetComparisonDelta(primaryElapsed.incomeDeltaMinor, primaryElapsed.incomePercentChange, currency, fractionDigits)}` :
                    "No hay días comparables con cobertura completa."}</p>
                </details>
              )}
            </section>
          </div>
        )}
        <BudgetAllocationTable
          allocations={analysis.allocations}
          comparison={comparison}
          currency={currency}
          isFilteredComparison={analysis.isFilteredComparison}
          fractionDigits={fractionDigits}
          onInspectConsumption={(path, title, trigger) => setDetail({ title, path, trigger })}
        />
      </Panel>
      {detail === null ? null : (
        <BudgetConsumptionDialog
          contributions={detail.path === null ? analysis.contributions : budgetContributionsForPath(analysis.contributions, detail.path)}
          currency={currency}
          dataset={dataset}
          dateBasis={analysis.dateBasis ?? "operation"}
          fractionDigits={fractionDigits}
          onDismiss={() => setDetail(null)}
          title={detail.title}
          trigger={detail.trigger}
        />
      )}
    </AnalyticsPage>
  );
}
