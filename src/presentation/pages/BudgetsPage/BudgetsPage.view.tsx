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
import { BudgetControls } from "./components/BudgetControls/BudgetControls.tsx";
import { BudgetUtilization } from "./components/BudgetUtilization/BudgetUtilization.tsx";
import styles from "./BudgetsPage.module.css";

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

export function BudgetsPageView({
  analysis,
  budgetOptions,
  emptyDescription,
  emptyTitle,
  onBudgetChange,
  onPeriodChange,
  periodOptions,
  searchPending,
  selectedBudgetUuid,
  selectedPeriodKey,
}: BudgetsPageViewProps) {
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
  const amountFormatter = budgetAmountFormatter(currency, fractionDigits);
  const toMajor = (amountMinor: number) =>
    budgetMinorToMajor(amountMinor, fractionDigits);
  const utilization = global.utilization ?? 0;

  return (
    <AnalyticsPage
      description="Límites, gasto neto y disponibilidad del periodo. Los importes reales ya incorporan los filtros globales y sólo después se cruzan con las fechas del presupuesto."
      eyebrow="Planificación financiera"
      notice={searchPending ? "Actualizando filtros…" : undefined}
      title="Presupuestos"
    >
      <Panel
        className={styles.controlsPanel}
        description="La selección es local a esta vista. El filtro guardado por el presupuesto se combina con cuentas, categorías, estados y búsqueda globales."
        title="Marco de análisis"
      >
        {controls}
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
          detail="Reembolsos descontados · VOID excluido"
          formatValue={amountFormatter}
          icon={<Icon name="receipt" />}
          label="Gasto neto"
          tone={global.consumedMinor > global.assignedMinor ? "negative" : "warning"}
          value={toMajor(global.consumedMinor)}
        />
        <KpiCard
          detail={`${analysis.filteredPostingCount} apuntes efectivos`}
          formatValue={amountFormatter}
          icon={<Icon name="trend" />}
          label="Disponible"
          tone={global.availableMinor < 0 ? "negative" : "positive"}
          value={toMajor(global.availableMinor)}
        />
        <KpiCard
          detail={global.utilization === null ? "Sin límite global" : analysis.period.label}
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
          value={utilization}
        />
      </AnalyticsPageGrid>

      <Panel
        className={styles.progressPanel}
        description={`${analysis.period.startDate} — ${analysis.period.endDate}`}
        title={`${analysis.budget.title} · ${analysis.period.label}`}
      >
        <div className={styles.progressLayout}>
          <BudgetUtilization
            health={global.health}
            label="Ritmo de consumo global"
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
        <BudgetAllocationTable
          allocations={analysis.allocations}
          currency={currency}
          fractionDigits={fractionDigits}
        />
      </Panel>
    </AnalyticsPage>
  );
}
