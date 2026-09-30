import { Icon } from "../../components/atoms/Icon/index.ts";
import { FinancialFactList } from "../../components/molecules/FinancialFactList/index.ts";
import { InformationDisclosure } from "../../components/molecules/InformationDisclosure/InformationDisclosure.tsx";
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
      description="Entradas, salidas y resultado del periodo seleccionado."
      title="Flujo de caja"
    >
      <AnalyticsPageGrid className={styles.primaryKpis} variant="three">
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
      </AnalyticsPageGrid>

      <p className={styles.scopeNote}>El flujo real usa cuentas sin deuda e incluye pagos transferidos hacia cuentas de deuda. Las transferencias propias aparecen en entradas y salidas; se compensan en el neto cuando ambos extremos están seleccionados.</p>

      <div className={styles.consolidatedResult}>
        <FinancialFactList items={[{
          id: "consolidated-result",
          label: "Resultado consolidado",
          value: formatEuroMinor(savingsEurMinor),
        }]} />
        <p>Ingresos netos menos gastos netos; no equivale al efectivo disponible.</p>
      </div>

      <AnalyticsPageGrid variant="two">
        <Panel className={styles.chartPanel}>
          <LineChart
            description="Movimiento neto y flujo sin cuentas de deuda."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            series={lineSeries}
            title="Flujo neto por periodo"
          />
        </Panel>
        <Panel className={styles.chartPanel}>
          <DivergingBarChart
            data={periodBars}
            description="Dinero salido y recibido en las cuentas de efectivo seleccionadas."
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

      <details className={styles.details}>
        <summary>Composición del flujo</summary>
        <AnalyticsPageGrid className={styles.detailsBody} variant="main-aside">
          <Panel>
            <HorizontalBarChart
              title="Presión por categoría"
              description="Gasto neto por raíz en el ámbito elegido. Un importe negativo puede deberse a devoluciones o a asignaciones en deudas, no a un gasto adicional."
              formatValue={euroFormatter}
              data={expenseCategories.map((category) => ({ id: category.id, label: category.name, value: euroFromMinor(-category.summary.expensesEurMinor), color: category.summary.expensesEurMinor > 0 ? "#286a4c" : "#a33f36" }))}
            />
            {(composition.debtExpenseAdjustmentsEurMinor ?? 0) !== 0 ? <p className={styles.scopeNote}>Asignación de gasto en deudas: {formatEuroMinor(composition.debtExpenseAdjustmentsEurMinor ?? 0)}; no es una devolución.</p> : null}
            {(composition.debtIncomeAdjustmentsEurMinor ?? 0) !== 0 ? <p className={styles.scopeNote}>Asignación de ingreso en deudas: {formatEuroMinor(composition.debtIncomeAdjustmentsEurMinor ?? 0)}; no es una reversión de ingreso.</p> : null}
          </Panel>
          <Panel title="Transferencias">
            <FinancialFactList items={[
              { id: "Entradas", label: "Entradas", value: formatEuroMinor(composition.transferInflowsEurMinor) },
              { id: "Salidas", label: "Salidas", value: formatEuroMinor(composition.transferOutflowsEurMinor) },
              { id: "Neto", label: "Neto", value: formatEuroMinor(composition.netTransfersEurMinor) },
            ]} />
          </Panel>
        </AnalyticsPageGrid>
      </details>
      <InformationDisclosure label="Información del flujo de caja">
        <div className={styles.informationBody}>
          <p>Ingresos y gastos brutos conservan sus importes antes de devoluciones y asignaciones. El resultado consolidado resta gastos netos de ingresos netos y no representa saldo disponible.</p>
          <p>Las entradas y salidas reales incluyen transferencias categorizadas y sin categoría. Un importe negativo por categoría puede deberse a devoluciones o asignaciones, no a un gasto adicional.</p>
        </div>
      </InformationDisclosure>
    </AnalyticsPage>
  );
}
