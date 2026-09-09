import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { DivergingBarChart } from "../../components/organisms/DivergingBarChart/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { HorizontalBarChart } from "../../components/organisms/HorizontalBarChart/index.ts";
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
      description="El flujo real y las entradas/salidas excluyen las cuentas de deuda e incluyen el dinero transferido hacia ellas. Ingresos, gastos y resultado consolidado corresponden al ámbito seleccionado."
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
          detail="Ingresos netos menos gastos netos; no equivale al efectivo disponible"
          formatValue={euroFormatter}
          icon={<Icon name="transfer" />}
          label="Resultado consolidado"
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
            description="Dinero salido y recibido en las cuentas de efectivo seleccionadas, incluidas transferencias categorizadas y sin categoría. Las transferencias entre cuentas propias aparecen en ambos lados."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            leftColor="#a33f36"
            leftLabel="Salidas reales"
            rightColor="#286a4c"
            rightLabel="Entradas reales"
            title="Tensión entre entradas y salidas"
          />
        </Panel>
      </AnalyticsPageGrid>

      <AnalyticsPageGrid variant="main-aside">
        <Panel>
          <HorizontalBarChart
            title="Presión por categoría"
            description="Gasto neto por raíz en el ámbito elegido. Un importe negativo es un abono, no un gasto adicional."
            formatValue={euroFormatter}
            data={expenseCategories.map((category) => ({ id: category.id, label: category.name, value: euroFromMinor(-category.summary.expensesEurMinor), color: category.summary.expensesEurMinor > 0 ? "#286a4c" : "#a33f36" }))}
          />
          <p>Asignación de gasto en deudas: {formatEuroMinor(composition.debtExpenseAdjustmentsEurMinor ?? 0)}. No es una devolución.</p>
          {(composition.debtIncomeAdjustmentsEurMinor ?? 0) !== 0 ? <p>Asignación de ingreso en deudas: {formatEuroMinor(composition.debtIncomeAdjustmentsEurMinor ?? 0)}. No es una reversión de ingreso.</p> : null}
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
