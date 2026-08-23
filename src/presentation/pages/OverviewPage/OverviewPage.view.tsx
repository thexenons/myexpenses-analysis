import type { CSSProperties } from "react";

import { Badge } from "../../components/atoms/Badge/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { EmptyState } from "../../components/molecules/EmptyState/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { AreaChart } from "../../components/organisms/AreaChart/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import {
  countFormatter,
  euroFormatter,
  euroFromMinor,
  formatEuroMinor,
  formatPeriodLabel,
} from "../../utils/format.ts";
import styles from "./OverviewPage.module.css";
import type { OverviewPageViewProps } from "./OverviewPage.types.ts";

export function OverviewPageView({
  accounts,
  chartSeries,
  debtAccountCount,
  debtBalanceEurMinor,
  expenseComposition,
  kpis,
  searchPending,
  status,
  topCategories,
  valuationBalanceEurMinor,
}: OverviewPageViewProps) {
  return (
    <AnalyticsPage
      description="Una lectura consolidada de patrimonio, movimientos, gasto real y deuda. Las magnitudes del periodo responden a los filtros; la valoración actual conserva el corte final de las cuentas seleccionadas."
      notice={searchPending ? "Actualizando resultados…" : undefined}
      title="Resumen general"
    >
      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail={`${countFormatter.format(kpis.postingCount)} apuntes`}
          formatValue={euroFormatter}
          icon={<Icon name="trend" />}
          label="Flujo del periodo"
          tone={kpis.netEurMinor >= 0 ? "positive" : "negative"}
          value={euroFromMinor(kpis.netEurMinor)}
        />
        <KpiCard
          detail={`${formatEuroMinor(kpis.grossIncomeEurMinor)} bruto`}
          formatValue={euroFormatter}
          icon={<Icon name="bank" />}
          label="Ingresos netos"
          tone="positive"
          value={euroFromMinor(kpis.incomesEurMinor)}
        />
        <KpiCard
          detail={`${formatEuroMinor(kpis.expenseRefundsEurMinor)} devuelto`}
          formatValue={euroFormatter}
          icon={<Icon name="receipt" />}
          label="Gastos netos"
          tone="negative"
          value={euroFromMinor(Math.abs(kpis.expensesEurMinor))}
        />
        <KpiCard
          detail={`${debtAccountCount} cuentas`}
          formatValue={euroFormatter}
          icon={<Icon name="debt" />}
          label="Saldo en deudas"
          tone="warning"
          value={euroFromMinor(debtBalanceEurMinor)}
        />
      </AnalyticsPageGrid>

      <div className={styles.statsStrip}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Apertura del periodo</span>
          <strong className={styles.statValue}>
            {formatEuroMinor(kpis.periodOpeningBalanceEurMinor)}
          </strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Cierre estimado</span>
          <strong className={styles.statValue}>
            {formatEuroMinor(kpis.periodClosingBalanceEurMinor)}
          </strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Valoración actual por cuenta</span>
          <strong className={styles.statValue}>
            {formatEuroMinor(valuationBalanceEurMinor)}
          </strong>
          <span className={styles.statContext}>Corte final · ámbito y cuentas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Flujo real</span>
          <strong className={styles.statValue}>
            {formatEuroMinor(kpis.realCashFlowEurMinor)}
          </strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Transferencias</span>
          <strong className={styles.statValue}>
            {formatEuroMinor(kpis.transfersEurMinor)}
          </strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Reconciliados</span>
          <strong className={styles.statValue}>
            {countFormatter.format(status.RECONCILED.count)}
          </strong>
        </div>
      </div>

      <AnalyticsPageGrid variant="main-aside">
        <Panel className={styles.chartPanel}>
          <AreaChart
            description="Ingresos, gastos firmados y movimiento neto del ámbito seleccionado."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            series={chartSeries}
            title="Pulso financiero"
          />
        </Panel>

        <Panel
          actions={<Icon name="category" size={18} />}
          description="Actividad neta por raíz"
          title="Categorías dominantes"
        >
          {topCategories.length === 0 ? (
            <EmptyState
              description="No hay actividad categorizada dentro del periodo y los filtros actuales."
              icon={<Icon name="category" />}
              title="Sin categorías dominantes"
            />
          ) : (
            <div className={styles.rankList}>
            {topCategories.map(({ activityPercent, category }) => (
              <div className={styles.rankRow} key={category.id}>
                <span className={styles.rankLabel}>{category.name}</span>
                <span className={styles.rankTrack}>
                  <span
                    className={styles.rankFill}
                    style={
                      {
                        "--bar-width": `${activityPercent}%`,
                        "--bar-color":
                          category.categoryType === "EXPENSE"
                            ? "var(--expense)"
                            : category.categoryType === "INCOME"
                              ? "var(--income)"
                              : "var(--transfer)",
                      } as CSSProperties
                    }
                  />
                </span>
                <span className={styles.rankValue}>
                  {formatEuroMinor(category.summary.netEurMinor)}
                </span>
              </div>
            ))}
            </div>
          )}
        </Panel>
      </AnalyticsPageGrid>

      <AnalyticsPageGrid variant="two">
        <Panel
          actions={<Icon name="receipt" size={18} />}
          description="Bruto, devoluciones y neto"
          title="Composición del gasto"
        >
          <div className={styles.compositionList}>
            {expenseComposition.map(({ amountEurMinor, label }) => (
              <div className={styles.compositionRow} key={label}>
                <span className={styles.compositionLabel}>{label}</span>
                <strong className={styles.compositionValue}>
                  {formatEuroMinor(amountEurMinor)}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          actions={<Icon name="transfer" size={18} />}
          description="Qué está incluido en este corte"
          title="Lectura rápida"
        >
          <div className={styles.compositionList}>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Cuentas activas</span>
              <Badge tone="cash">{countFormatter.format(accounts.length)}</Badge>
            </div>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Sin reconciliar</span>
              <Badge tone="warning">
                {countFormatter.format(status.UNRECONCILED.count)}
              </Badge>
            </div>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Compensados</span>
              <Badge tone="info">
                {countFormatter.format(status.CLEARED.count)}
              </Badge>
            </div>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Anulados visibles</span>
              <Badge tone="neutral">
                {countFormatter.format(status.VOID.count)}
              </Badge>
            </div>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Flujo de deuda</span>
              <strong className={styles.compositionValue}>
                {formatEuroMinor(kpis.debtFlowEurMinor)}
              </strong>
            </div>
          </div>
        </Panel>
      </AnalyticsPageGrid>
    </AnalyticsPage>
  );
}
