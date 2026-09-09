import { Badge } from "../../components/atoms/Badge/index.ts";
import { Button } from "../../components/atoms/Button/index.ts";
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
  availableDebts,
  debtSeries,
  debts,
  onClearAccounts,
  onToggleAccount,
  onViewTransactions,
  selectedAccountIds,
  showClearAccounts,
  totals,
}: DebtsPageViewProps) {
  const netFunding = totals.advancesEurMinor - totals.recoveriesEurMinor;

  return (
    <AnalyticsPage
      description="Dinero enviado y recibido, gastos atribuidos y saldos de las cuentas de deuda. Las transferencias se identifican por su contrapartida; el signo del saldo por sí solo no indica quién debe a quién."
      introAction={
        showClearAccounts ? (
          <Button onClick={onClearAccounts} variant="secondary">
            Ver todas las deudas
          </Button>
        ) : undefined
      }
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
          <p className={styles.debtSummaryNote}>
            Saldo real al cierre de las fechas elegidas. Los filtros de contenido
            y origen/destino solo limitan los movimientos y gastos analizados.
          </p>
        </div>
        <Badge tone="warning">
          {countFormatter.format(debts.length)} cuentas incluidas
        </Badge>
      </div>

      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail="Transferencias desde cuentas propias hacia estas cuentas"
          formatValue={euroFormatter}
          icon={<Icon name="arrow-down-right" />}
          label="Enviado a deudas"
          tone="negative"
          value={euroFromMinor(totals.advancesEurMinor)}
        />
        <KpiCard
          detail="Transferencias efectivamente recibidas en cuentas propias"
          formatValue={euroFormatter}
          icon={<Icon name="arrow-up-right" />}
          label="Recibido de deudas"
          tone="positive"
          value={euroFromMinor(totals.recoveriesEurMinor)}
        />
        <KpiCard
          detail="Gastos directos y partes financiadas desde cuentas propias"
          formatValue={euroFormatter}
          icon={<Icon name="debt" />}
          label="Gasto bruto atribuido"
          tone="warning"
          value={euroFromMinor(totals.expensesEurMinor)}
        />
        <KpiCard
          detail={`${formatEuroMinor(totals.expenseRefundsEurMinor)} en devoluciones de gasto`}
          formatValue={euroFormatter}
          icon={<Icon name="receipt" />}
          label="Gasto neto atribuido"
          tone="warning"
          value={euroFromMinor(totals.expensesEurMinor - totals.expenseRefundsEurMinor)}
        />
        <KpiCard
          detail="Enviado menos recibido en cuentas propias"
          formatValue={euroFormatter}
          icon={<Icon name="transfer" />}
          label="Aportación neta"
          tone={netFunding > 0 ? "negative" : "positive"}
          value={euroFromMinor(netFunding)}
        />
        <KpiCard
          detail="Suma de los movimientos filtrados, incluidos ajustes"
          formatValue={euroFormatter}
          icon={<Icon name="debt" />}
          label="Movimiento neto"
          tone="neutral"
          value={euroFromMinor(totals.flowEurMinor)}
        />
      </AnalyticsPageGrid>

      <AnalyticsPageGrid variant="two">
        <Panel className={styles.chartPanel}>
          <LineChart
            description="Los movimientos respetan todos los filtros. El saldo real incorpora todos los movimientos de las cuentas seleccionadas, aunque no coincidan con los filtros de contenido."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            series={debtSeries}
            title="Evolución de la selección"
          />
        </Panel>
        <Panel className={styles.chartPanel}>
          <HorizontalBarChart
            data={accountBars}
            description="Saldo real ordenado por importe absoluto. Selecciona una cuenta para ver sus movimientos."
            formatValue={euroFormatter}
            initialLimit={0}
            labelHeader="Cuenta"
            onSelectDatum={onViewTransactions}
            title="Quién concentra el saldo"
          />
        </Panel>
      </AnalyticsPageGrid>

      <Panel
        actions={
          <Button
            disabled={debts.length === 0}
            onClick={() => onViewTransactions()}
            variant="secondary"
          >
            Ver movimientos de la selección
          </Button>
        }
        description="Incluye o excluye cuentas manteniendo al menos una seleccionada. Abre sus movimientos para consultar el detalle con los filtros actuales."
        title="Seleccionar cuentas de deuda"
      >
        {availableDebts.length === 0 ? (
          <EmptyState
            description="El ámbito y los filtros actuales no contienen cuentas marcadas como deuda."
            icon={<Icon name="debt" />}
            title="No hay deudas en este ámbito"
          />
        ) : (
          <div className={styles.accountGrid}>
            {availableDebts.map((debt) => {
              const selected = selectedAccountIds.has(debt.account.id);
              return (
                <article
                  className={styles.accountCard}
                  data-selected={selected}
                  key={debt.account.id}
                >
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
                      Movimiento filtrado {formatEuroMinor(debt.netEurMinor)}
                    </span>
                    <span className={styles.accountMeta}>
                      Apertura {formatEuroMinor(debt.periodOpeningBalanceEurMinor)}
                    </span>
                  </div>
                  <dl className={styles.accountMetrics}>
                    <dt>Enviado</dt>
                    <dd>{formatEuroMinor(debt.advancesEurMinor)}</dd>
                    <dt>Recibido</dt>
                    <dd>{formatEuroMinor(debt.recoveriesEurMinor)}</dd>
                    <dt>Gasto neto atribuido</dt>
                    <dd>{formatEuroMinor(debt.grossDebtExpensesEurMinor - debt.debtExpenseRefundsEurMinor)}</dd>
                  </dl>
                  <Button
                    aria-label={`${selected ? "Excluir" : "Incluir"} ${debt.account.label}`}
                    aria-pressed={selected}
                    disabled={selected && selectedAccountIds.size === 1}
                    onClick={() => onToggleAccount(debt.account.id)}
                    size="compact"
                    variant={selected ? "primary" : "secondary"}
                  >
                    {selected ? "Excluir" : "Incluir"}
                  </Button>
                  <Button
                    aria-label={`Ver movimientos de ${debt.account.label}`}
                    onClick={() => onViewTransactions(debt.account.id)}
                    size="compact"
                    variant="secondary"
                  >
                    Ver movimientos
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </AnalyticsPage>
  );
}
