import { Badge } from "../../components/atoms/Badge/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { FinancialFactList } from "../../components/molecules/FinancialFactList/index.ts";
import { InformationDisclosure } from "../../components/molecules/InformationDisclosure/InformationDisclosure.tsx";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { AreaChart } from "../../components/organisms/AreaChart/index.ts";
import { HorizontalBarChart } from "../../components/organisms/HorizontalBarChart/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import {
  countFormatter,
  euroFormatter,
  euroFromMinor,
  formatCount,
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
  const expenseAllocation = kpis.debtExpenseAdjustmentsEurMinor ?? 0;
  const incomeAllocation = kpis.debtIncomeAdjustmentsEurMinor ?? 0;
  const incomeDetail = `${formatEuroMinor(kpis.grossIncomeEurMinor)} bruto`;
  const expenseDetail = `${formatEuroMinor(kpis.expenseRefundsEurMinor)} devuelto`;

  return (
    <AnalyticsPage
      description="Flujo seleccionado y evolución de las cuentas."
      notice={searchPending ? "Actualizando resultados…" : undefined}
      title="Resumen general"
    >
      <AnalyticsPageGrid className={styles.primaryKpis} variant="three">
        <KpiCard
          detail={formatCount(kpis.postingCount, "apunte", "apuntes")}
          formatValue={euroFormatter}
          icon={<Icon name="trend" />}
          label="Flujo del periodo"
          tone={kpis.netEurMinor >= 0 ? "positive" : "negative"}
          value={euroFromMinor(kpis.netEurMinor)}
        />
        <KpiCard
          detail={incomeAllocation === 0
            ? incomeDetail
            : `${incomeDetail} · Asignación en deudas: ${formatEuroMinor(incomeAllocation)}; no es reversión de ingreso.`}
          formatValue={euroFormatter}
          icon={<Icon name="bank" />}
          label="Ingresos netos"
          tone="positive"
          value={euroFromMinor(kpis.incomesEurMinor)}
        />
        <KpiCard
          detail={expenseAllocation === 0
            ? expenseDetail
            : `${expenseDetail} · Asignación en deudas: ${formatEuroMinor(expenseAllocation)}; no es devolución.`}
          formatValue={euroFormatter}
          icon={<Icon name="receipt" />}
          label="Gastos netos"
          tone={kpis.expensesEurMinor > 0 ? "positive" : "negative"}
          value={euroFromMinor(-kpis.expensesEurMinor)}
        />
      </AnalyticsPageGrid>

      <p className={styles.scopeNote}>El flujo usa los apuntes filtrados; los saldos de apertura, cierre y deuda incluyen todo el historial de las cuentas seleccionadas hasta el corte.</p>

      <Panel className={styles.chartPanel}>
        <AreaChart
          description="Ingresos, movimiento contable de gastos y movimiento neto del ámbito seleccionado; se conserva el signo de los apuntes."
          formatLabel={formatPeriodLabel}
          formatValue={euroFormatter}
          series={chartSeries}
          title="Pulso financiero"
        />
      </Panel>

      <details className={styles.details}>
        <summary>Saldos, deuda y conciliación</summary>
        <div className={styles.detailsBody}>
          <FinancialFactList items={[
            { id: "Apertura del periodo", label: "Apertura del periodo", value: formatEuroMinor(kpis.periodOpeningBalanceEurMinor) },
            { id: "Saldo al cierre del periodo", label: "Saldo al cierre del periodo", value: formatEuroMinor(kpis.periodClosingBalanceEurMinor) },
            { id: "Valoración actual por cuenta · corte final, ámbito y cuentas", label: "Valoración actual por cuenta · corte final, ámbito y cuentas", value: formatEuroMinor(valuationBalanceEurMinor) },
            { id: "Saldo en deudas", label: "Saldo en deudas", value: <>{formatEuroMinor(debtBalanceEurMinor)} · {formatCount(debtAccountCount, "cuenta", "cuentas")}</> },
            { id: "Flujo real", label: "Flujo real", value: formatEuroMinor(kpis.realCashFlowEurMinor) },
            { id: "Flujo de deuda", label: "Flujo de deuda", value: formatEuroMinor(kpis.debtFlowEurMinor) },
            { id: "Transferencias", label: "Transferencias", value: formatEuroMinor(kpis.transfersEurMinor) },
            { id: "Reconciliados", label: "Reconciliados", value: countFormatter.format(status.RECONCILED.count) },
            { id: "Sin conciliar", label: "Sin conciliar", value: <Badge tone="warning">{countFormatter.format(status.UNRECONCILED.count)}</Badge> },
            { id: "Compensados", label: "Compensados", value: <Badge tone="info">{countFormatter.format(status.CLEARED.count)}</Badge> },
            { id: "Cuentas activas", label: "Cuentas activas", value: <Badge tone="cash">{countFormatter.format(accounts.length)}</Badge> },
          ]} />
        </div>
      </details>

      <details className={styles.details}>
        <summary>Composición y categorías</summary>
        <AnalyticsPageGrid className={styles.detailsBody} variant="two">
          <Panel>
            <HorizontalBarChart
              title="Categorías dominantes"
              description="Actividad neta por categoría raíz. Elige cuántas mostrar; la tabla y el CSV incluyen todas."
              formatValue={euroFormatter}
              labelHeader="Categoría"
              data={topCategories.map(({ category }) => ({
                id: category.id,
                label: category.name,
                value: euroFromMinor(category.summary.netEurMinor),
                color: category.categoryType === "EXPENSE" ? "#a33f36" : category.categoryType === "INCOME" ? "#286a4c" : "#35698b",
              }))}
            />
          </Panel>
          <Panel
            actions={<Icon name="receipt" size={18} />}
            title="Composición del gasto"
          >
            <FinancialFactList items={expenseComposition.map(({ amountEurMinor, label }) => ({
              id: label,
              label,
              value: formatEuroMinor(amountEurMinor),
            }))} />
          </Panel>
        </AnalyticsPageGrid>
      </details>
      <InformationDisclosure label="Información del resumen">
        <div className={styles.informationBody}>
          <p>Gasto neto = bruto − devoluciones − asignación en deudas. Un neto negativo puede deberse a devoluciones o a asignaciones; las asignaciones no son dinero devuelto.</p>
          <p>Asignación en deudas: {formatEuroMinor(expenseAllocation)} en gastos y {formatEuroMinor(incomeAllocation)} en ingresos. La asignación de ingreso no es una reversión de ingreso.</p>
          <p>Las categorías dominantes agrupan actividad neta por raíz; los importes de padres e hijos no se suman dos veces.</p>
        </div>
      </InformationDisclosure>
    </AnalyticsPage>
  );
}
