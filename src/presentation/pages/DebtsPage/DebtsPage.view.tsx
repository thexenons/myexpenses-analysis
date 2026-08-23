import { Badge } from "../../components/atoms/Badge/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { EmptyState } from "../../components/molecules/EmptyState/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { HorizontalBarChart } from "../../components/organisms/HorizontalBarChart/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import {
  countFormatter,
  euroFormatter,
  euroFromMinor,
  formatEuroMinor,
  formatPeriodLabel,
} from "../../utils/format.ts";
import styles from "./DebtsPage.module.css";
import type { DebtsPageViewProps } from "./DebtsPage.types.ts";

export function DebtsPageView({
  accountBars,
  debtSeries,
  debts,
  totals,
}: DebtsPageViewProps) {
  const balanceVariation =
    totals.recoveriesEurMinor - totals.advancesEurMinor;

  return (
    <AnalyticsPage
      description="Evolución de las cuentas marcadas como deuda, separada del dinero que realmente entra y sale de las cuentas operativas."
      title="Deudas"
    >
      <div className={styles.debtSummary}>
        <div>
          <span className={styles.debtSummaryLabel}>
            Saldo conjunto en deudas
          </span>
          <div className={styles.debtSummaryValue}>
            {formatEuroMinor(totals.balanceEurMinor)}
          </div>
        </div>
        <Badge tone="warning">
          {countFormatter.format(debts.length)} cuentas seleccionadas
        </Badge>
      </div>

      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail="Salidas o nuevos importes pendientes"
          formatValue={euroFormatter}
          icon={<Icon name="arrow-down-right" />}
          label="Nuevos adelantos"
          tone="negative"
          value={euroFromMinor(totals.advancesEurMinor)}
        />
        <KpiCard
          detail="Entradas y devoluciones"
          formatValue={euroFormatter}
          icon={<Icon name="arrow-up-right" />}
          label="Recuperaciones"
          tone="positive"
          value={euroFromMinor(totals.recoveriesEurMinor)}
        />
        <KpiCard
          detail="Apuntes clasificados como gasto"
          formatValue={euroFormatter}
          icon={<Icon name="debt" />}
          label="Gasto bruto en deudas"
          tone="warning"
          value={euroFromMinor(totals.expensesEurMinor)}
        />
        <KpiCard
          detail="Recuperado menos adelantado"
          formatValue={euroFormatter}
          icon={<Icon name="debt" />}
          label="Variación neta"
          tone={balanceVariation >= 0 ? "positive" : "negative"}
          value={euroFromMinor(balanceVariation)}
        />
      </AnalyticsPageGrid>

      <AnalyticsPageGrid variant="two">
        <Panel className={styles.chartPanel}>
          <LineChart
            description="Contrasta el movimiento de las cuentas de deuda con el flujo real."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            series={debtSeries}
            title="Deuda frente a caja"
          />
        </Panel>
        <Panel className={styles.chartPanel}>
          <HorizontalBarChart
            data={accountBars}
            description="Saldo firmado de las cuentas con mayor posición absoluta."
            formatValue={euroFormatter}
            labelHeader="Cuenta"
            title="Quién concentra el saldo"
          />
        </Panel>
      </AnalyticsPageGrid>

      <Panel
        description="Apertura, movimiento del periodo y saldo resultante"
        title="Detalle por cuenta"
      >
        {debts.length === 0 ? (
          <EmptyState
            description="El ámbito y los filtros actuales no contienen cuentas marcadas como deuda."
            icon={<Icon name="debt" />}
            title="No hay deudas en este ámbito"
          />
        ) : (
          <div className={styles.accountGrid}>
          {debts.map((debt) => (
            <article className={styles.accountCard} key={debt.account.id}>
              <div className={styles.accountHeader}>
                <div>
                  <h3 className={styles.accountName}>{debt.account.label}</h3>
                  <p className={styles.accountMeta}>
                    {countFormatter.format(debt.postingCount)} apuntes
                  </p>
                </div>
                <Badge tone="debt">Deuda</Badge>
              </div>
              <strong className={styles.accountBalance}>
                {formatEuroMinor(debt.periodClosingBalanceEurMinor)}
              </strong>
              <div className={styles.accountFooter}>
                <span className={styles.accountMeta}>
                  Periodo {formatEuroMinor(debt.netEurMinor)}
                </span>
                <span className={styles.accountMeta}>
                  Apertura {formatEuroMinor(debt.periodOpeningBalanceEurMinor)}
                </span>
              </div>
            </article>
          ))}
          </div>
        )}
      </Panel>
    </AnalyticsPage>
  );
}
