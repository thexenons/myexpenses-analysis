import { useState } from "react";

import { budgetContributionsForPath } from "../../../domain/analytics/budgets.ts";
import { EmptyState } from "../../components/molecules/EmptyState/EmptyState.tsx";
import { Icon } from "../../components/atoms/Icon/Icon.tsx";
import { KpiCard } from "../../components/molecules/KpiCard/KpiCard.tsx";
import { InformationDisclosure } from "../../components/molecules/InformationDisclosure/InformationDisclosure.tsx";
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
  return `Media: ${mean.periodCount} ${mean.periodCount === 1 ? unit[0] : unit[1]} ${mean.periodCount === 1 ? "completo" : "completos"}.`;
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
        description="Compara el gasto neto con el límite y el historial del presupuesto."
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
      description="Compara el gasto neto con el límite y el historial del presupuesto."
      eyebrow="Planificación financiera"
      notice={searchPending ? "Actualizando filtros…" : undefined}
      title="Presupuestos"
    >
      <Panel
        className={styles.controlsPanel}
        title="Marco de análisis"
      >
        {controls}
        <p className={styles.scopeNote}>
          {analysis.budget.title} · {analysis.period.label}. Fecha de {analysis.dateBasis === "value" ? "valor (operación si falta)" : "operación"}.
          {" "}{analysis.consumptionDateRange === null
            ? "No hay solapamiento entre las fechas globales y el periodo del presupuesto."
            : `Consumo consultado: ${formatDate(analysis.consumptionDateRange?.from ?? analysis.period.startDate)} – ${formatDate(analysis.consumptionDateRange?.to ?? analysis.period.endDate)}.`}
        </p>
        <p className={styles.scopeWarning}>
          {analysis.isFilteredComparison
            ? "Corte filtrado: el límite y los arrastres son del periodo completo, sin prorratear. Asignado menos corte y utilización no indican la disponibilidad real del presupuesto completo."
            : "Límite y arrastres del periodo completo, sin prorratear."}
        </p>
      </Panel>

      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail={`Base ${formatBudgetMinor(global.baseMinor, currency, fractionDigits)} · No se calcula sumando categorías.`}
          formatValue={amountFormatter}
          icon={<Icon name="wallet" />}
          label="Asignado total"
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
          emptyValue="Sin límite total"
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

      <div className={styles.progressSummary}>
        <BudgetUtilization
          health={analysis.isFilteredComparison ? "unallocated" : global.health}
          label={analysis.isFilteredComparison ? "Utilización del corte filtrado" : "Ritmo de consumo total"}
          utilization={global.utilization}
        />
        {analysis.isFilteredComparison ? null : (
          <p className={styles.healthNote}>
            {global.health === "exceeded" ? "Límite total excedido." :
              global.health === "watch" ? "Cerca del límite total." :
                global.health === "unallocated" ? "Sin límite total asignado." : "Dentro del límite total."}
          </p>
        )}
      </div>

      <Panel
        className={styles.allocationsPanel}
        description="Los hijos detallan el total del padre; no se suman de nuevo."
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
                `Referencia principal: ${primaryReference.range.label}${primaryReference.status === "unavailable" ? " · sin datos completos" : ""}.`}
              {" "}{meanContext(comparison.mean)}
              {" "}Referencia y media: periodos completos, sin prorrateo.
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
      <InformationDisclosure label="Información del presupuesto">
        <div className={styles.informationBody}>
          <p>El filtro del presupuesto se combina con cuentas, categorías y búsqueda globales antes de cruzarse con las fechas del periodo.</p>
          <p>Un padre con asignación propia limita todo su subárbol; sus hijos son detalle y no se vuelven a sumar. La asignación total procede de la fila técnica sin categoría y no se presenta como categoría inventada.</p>
          {primaryReference === undefined ? null : (
            <p>Referencia completa: {formatDate(primaryReference.range.startDate)} – {formatDate(primaryReference.range.endDate)}. No se prorratea con el corte actual.</p>
          )}
          {comparison?.mean.status === "ready" ? (
            <p>Historial de la media: {formatDate(comparison.mean.firstDate!)} – {formatDate(comparison.mean.lastDate!)}.</p>
          ) : null}
          <dl className={styles.ledger}>
            <div>
              <dt>Asignaciones categorizadas</dt>
              <dd>{formatBudgetMinor(analysis.categoryAssignedMinor, currency, fractionDigits)}</dd>
            </div>
            <div>
              <dt>Consumo sin asignación</dt>
              <dd>{formatBudgetMinor(analysis.unallocatedConsumedMinor, currency, fractionDigits)}</dd>
            </div>
            <div>
              <dt>Arrastre recibido</dt>
              <dd>{formatBudgetMinor(global.rolloverPreviousMinor, currency, fractionDigits)}</dd>
            </div>
            <div>
              <dt>Arrastre siguiente</dt>
              <dd>{formatBudgetMinor(global.rolloverNextMinor, currency, fractionDigits)}</dd>
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
      </InformationDisclosure>
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
