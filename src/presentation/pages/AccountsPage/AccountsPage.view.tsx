import { Badge } from "../../components/atoms/Badge/index.ts";
import { Button } from "../../components/atoms/Button/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { EmptyState } from "../../components/molecules/EmptyState/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { HorizontalBarChart } from "../../components/organisms/HorizontalBarChart/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import chartStyles from "../../components/organisms/chart/chart.module.css";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import { AccountDetails } from "./components/AccountDetails/index.ts";
import {
  countFormatter,
  euroFormatter,
  euroFromMinor,
  formatEuroMinor,
  formatPeriodLabel,
} from "../../utils/format.ts";
import styles from "./AccountsPage.module.css";
import type { AccountMetric, AccountsPageViewProps } from "./AccountsPage.types.ts";
import { ACCOUNT_METRIC_LABELS } from "./AccountsPage.helpers.ts";

const EXCHANGE_MODE_LABELS = {
  DYNAMIC: "Conversión dinámica",
  IDENTITY: "Sin conversión",
  STATIC: "Conversión estática",
} as const;

const ACCOUNT_SCOPE_LABELS = {
  DEBT: "Deuda",
  DEFAULT: "Operativa",
} as const;

const EMPTY_ACCOUNT_SERIES = [] as const;

export function AccountsPageView({
  accountBars,
  accountSeries = EMPTY_ACCOUNT_SERIES,
  accounts,
  metric = "periodClosingBalanceEurMinor",
  onMetricChange,
  onSelectAccount,
  onViewTransactions,
  onViewPeriod,
  totals,
}: AccountsPageViewProps) {
  return (
    <AnalyticsPage
      description="Saldos reales al cierre y movimientos dentro de los filtros. Las categorías limitan los movimientos, sin alterar el saldo real."
      title="Cuentas"
    >
      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail={`${countFormatter.format(accounts.length)} cuentas`}
          formatValue={euroFormatter}
          icon={<Icon name="wallet" />}
          label="Saldo real conjunto al cierre"
          tone={totals.closingEurMinor >= 0 ? "cash" : "negative"}
          value={euroFromMinor(totals.closingEurMinor)}
        />
        <KpiCard
          detail="Movimiento dentro del filtro"
          formatValue={euroFormatter}
          icon={<Icon name="bank" />}
          label="Flujo en cuentas"
          tone={totals.flowEurMinor >= 0 ? "positive" : "negative"}
          value={euroFromMinor(totals.flowEurMinor)}
        />
        <KpiCard
          detail={`${accounts.length - totals.debtCount} operativas`}
          formatValue={countFormatter}
          icon={<Icon name="debt" />}
          label="Cuentas de deuda"
          tone="warning"
          value={totals.debtCount}
        />
        <KpiCard
          detail="Actividad contabilizada"
          formatValue={countFormatter}
          icon={<Icon name="bank" />}
          label="Apuntes visibles"
          tone="accent"
          value={totals.postingCount}
        />
      </AnalyticsPageGrid>

      <Panel className={styles.chartPanel}>
        <div className={chartStyles.controls}>
          <label className={chartStyles.control}>
            Métrica de cuentas
            <select value={metric} onChange={(event) => onMetricChange?.(event.target.value as AccountMetric)}>
              {Object.entries(ACCOUNT_METRIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <HorizontalBarChart
          data={accountBars}
          description={`${ACCOUNT_METRIC_LABELS[metric]}. Orden por importe absoluto; se conserva el signo.`}
          formatValue={euroFormatter}
          labelHeader="Cuenta"
          onSelectDatum={metric === "periodClosingBalanceEurMinor" ? undefined : onViewTransactions}
          title={metric === "periodClosingBalanceEurMinor" ? "Mapa de saldos" : "Comparación de cuentas"}
        />
      </Panel>

      <Panel className={styles.chartPanel}>
        <LineChart
          description={`${ACCOUNT_METRIC_LABELS[metric]}. Muestra u oculta cuentas en la leyenda; ajusta las fechas y la agrupación en los filtros globales.`}
          formatLabel={formatPeriodLabel}
          formatValue={euroFormatter}
          onSelectPeriod={metric === "periodClosingBalanceEurMinor" ? undefined : onViewPeriod}
          series={accountSeries}
          title="Evolución comparada de cuentas"
        />
      </Panel>

      <Panel
        description="Selecciona una cuenta para convertirla en filtro global"
        title="Inventario de cuentas"
      >
        {accounts.length === 0 ? (
          <EmptyState
            description="Amplía el periodo o revisa los filtros globales de cuentas."
            icon={<Icon name="bank" />}
            title="No hay cuentas en este ámbito"
          />
        ) : (
          <div className={styles.accountGrid}>
          {accounts.map((item) => (
            <article
              aria-label={`Cuenta ${item.account.label}`}
              className={styles.accountCard}
              key={item.account.id}
            >
              <div className={styles.accountHeader}>
                <div>
                  <h3 className={styles.accountName}>{item.account.label}</h3>
                  <p className={styles.accountMeta}>
                    {item.account.currency} · {EXCHANGE_MODE_LABELS[item.account.exchangeRateMode]}
                  </p>
                </div>
                <Badge tone={item.account.type === "DEBT" ? "debt" : "cash"}>
                  {ACCOUNT_SCOPE_LABELS[item.account.type]}
                </Badge>
              </div>
              <strong className={styles.accountBalance}>
                {formatEuroMinor(item.periodClosingBalanceEurMinor)}
              </strong>
              <div className={styles.accountFooter}>
                <span className={styles.accountMeta}>
                  Flujo {formatEuroMinor(item.netEurMinor)}
                </span>
                <span className={styles.accountMeta}>
                  {countFormatter.format(item.postingCount)} apuntes
                </span>
              </div>
              <div className={styles.accountActions}>
                <Button
                  aria-label={`Filtrar por ${item.account.label}`}
                  icon={<Icon name="filter" size={14} />}
                  onClick={() => onSelectAccount(item.account.id)}
                  size="compact"
                  variant="secondary"
                >
                  Filtrar
                </Button>
                {onViewTransactions ? (
                  <Button
                    aria-label={`Ver movimientos de ${item.account.label}`}
                    onClick={() => onViewTransactions(item.account.id)}
                    size="compact"
                    variant="secondary"
                  >
                    Movimientos
                  </Button>
                ) : null}
                <AccountDetails
                  exchangeRateToEur={item.exchangeRateToEur}
                  item={item}
                />
              </div>
            </article>
          ))}
          </div>
        )}
      </Panel>
    </AnalyticsPage>
  );
}
