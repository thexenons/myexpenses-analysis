import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { EmptyState } from "../../components/molecules/EmptyState/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { DivergingBarChart } from "../../components/organisms/DivergingBarChart/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import {
  euroFormatter,
  euroFromMinor,
  formatEuroMinor,
  formatPeriodLabel,
} from "../../utils/format.ts";
import styles from "./CashFlowPage.module.css";
import type { CashFlowPageViewProps } from "./CashFlowPage.types.ts";

export function CashFlowPageView({
  composition,
  expenseCategories,
  kpis,
  lineSeries,
  periodBars,
  savingsEurMinor,
}: CashFlowPageViewProps) {
  return (
    <AnalyticsPage
      description="Entradas y salidas separadas del efecto espejo de las cuentas de deuda. Compara neto, bruto y devoluciones a lo largo del tiempo."
      title="Flujo de caja"
    >
      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail="Sin espejos de deuda"
          formatValue={euroFormatter}
          icon={<Icon name="transfer" />}
          label="Flujo real"
          tone={kpis.realCashFlowEurMinor >= 0 ? "positive" : "negative"}
          value={euroFromMinor(kpis.realCashFlowEurMinor)}
        />
        <KpiCard
          detail={`Neto ${formatEuroMinor(composition.netIncomeEurMinor)}`}
          formatValue={euroFormatter}
          icon={<Icon name="arrow-up" />}
          label="Ingreso bruto"
          tone="positive"
          value={euroFromMinor(composition.grossIncomeEurMinor)}
        />
        <KpiCard
          detail={`${formatEuroMinor(composition.expenseRefundsEurMinor)} en devoluciones`}
          formatValue={euroFormatter}
          icon={<Icon name="arrow-down" />}
          label="Gasto bruto"
          tone="negative"
          value={euroFromMinor(composition.grossExpensesEurMinor)}
        />
        <KpiCard
          detail="Ingresos menos gastos"
          formatValue={euroFormatter}
          icon={<Icon name="transfer" />}
          label="Capacidad de ahorro"
          tone={savingsEurMinor >= 0 ? "positive" : "warning"}
          value={euroFromMinor(savingsEurMinor)}
        />
      </AnalyticsPageGrid>

      <AnalyticsPageGrid variant="two">
        <Panel className={styles.chartPanel}>
          <LineChart
            description="Diferencia entre todos los movimientos y el flujo sin cuentas de deuda."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            series={lineSeries}
            title="Flujo neto por periodo"
          />
        </Panel>
        <Panel className={styles.chartPanel}>
          <DivergingBarChart
            data={periodBars}
            description="Gastos a la izquierda e ingresos a la derecha."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            leftColor="#a33f36"
            leftLabel="Gastos"
            rightColor="#286a4c"
            rightLabel="Ingresos"
            title="Tensión entre entradas y salidas"
          />
        </Panel>
      </AnalyticsPageGrid>

      <AnalyticsPageGrid variant="main-aside">
        <Panel
          description="Gasto neto de las raíces activas"
          title="Presión por categoría"
        >
          {expenseCategories.length === 0 ? (
            <EmptyState
              description="No hay gasto categorizado dentro del periodo y los filtros actuales."
              icon={<Icon name="receipt" />}
              title="Sin presión por categoría"
            />
          ) : (
            <div className={styles.rankList}>
            {expenseCategories.map((category) => (
              <div className={styles.compositionRow} key={category.id}>
                <span className={styles.compositionLabel}>{category.name}</span>
                <strong className={styles.compositionValue}>
                  {formatEuroMinor(Math.abs(category.summary.expensesEurMinor))}
                </strong>
              </div>
            ))}
            </div>
          )}
        </Panel>
        <Panel
          description="Entradas y salidas internas"
          title="Transferencias"
        >
          <div className={styles.compositionList}>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Entradas</span>
              <strong className={styles.compositionValue}>
                {formatEuroMinor(composition.transferInflowsEurMinor)}
              </strong>
            </div>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Salidas</span>
              <strong className={styles.compositionValue}>
                {formatEuroMinor(composition.transferOutflowsEurMinor)}
              </strong>
            </div>
            <div className={styles.compositionRow}>
              <span className={styles.compositionLabel}>Neto</span>
              <strong className={styles.compositionValue}>
                {formatEuroMinor(composition.netTransfersEurMinor)}
              </strong>
            </div>
          </div>
        </Panel>
      </AnalyticsPageGrid>
    </AnalyticsPage>
  );
}
