import { Icon } from "../../components/atoms/Icon/Icon.tsx";
import { KpiCard } from "../../components/molecules/KpiCard/KpiCard.tsx";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/AnalyticsPage.tsx";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/AnalyticsPageGrid.tsx";
import { countFormatter } from "../../utils/format.ts";
import { InsightsAccounts } from "./components/InsightsAccounts/InsightsAccounts.tsx";
import { InsightsPayees } from "./components/InsightsPayees/InsightsPayees.tsx";
import { InsightsQuality } from "./components/InsightsQuality/InsightsQuality.tsx";
import { InsightsTiming } from "./components/InsightsTiming/InsightsTiming.tsx";
import styles from "./InsightsPage.module.css";
import type { InsightsPageViewProps } from "./InsightsPage.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function InsightsPageView({
  accountBars,
  hourSeries,
  insights,
  lagBars,
  searchPending,
  weekdayBars,
}: InsightsPageViewProps) {
  return (
    <AnalyticsPage
      className={styles.page}
      description="Patrones descriptivos y cobertura del dato enriquecido. Los análisis responden a los filtros globales; el ledger conserva además los conteos de origen. La vista no atribuye causas ni predice comportamiento."
      eyebrow="Cuaderno de señales"
      notice={searchPending ? "Actualizando patrones…" : undefined}
      title="Patrones y calidad"
    >
      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail={`${countFormatter.format(insights.payees.payeePostingCount)} de ${countFormatter.format(insights.payees.activePostingCount)} activos`}
          formatValue={percentageFormatter}
          icon={<Icon name="category" />}
          label="Cobertura de payee"
          tone="accent"
          value={insights.payees.coverageRatio}
        />
        <KpiCard
          detail={`${countFormatter.format(insights.timing.midnightOrMissingTimeCount)} a medianoche o sin precisión`}
          formatValue={countFormatter}
          icon={<Icon name="calendar" />}
          label="Hora local precisa"
          tone="info"
          value={insights.timing.timedPostingCount}
        />
        <KpiCard
          detail={`${countFormatter.format(insights.valueDates.valueDatePostingCount)} con fecha valor efectiva`}
          formatValue={countFormatter}
          icon={<Icon name="trend" />}
          label="Fecha valor distinta"
          tone="warning"
          value={insights.valueDates.distinctValueDateCount}
        />
        <KpiCard
          detail={`${countFormatter.format(insights.provenance.linkedPostingCount)} peers vinculados`}
          formatValue={countFormatter}
          icon={<Icon name="transfer" />}
          label="Partes split"
          tone="cash"
          value={insights.provenance.splitPartCount}
        />
      </AnalyticsPageGrid>

      <InsightsPayees payees={insights.payees} />
      <InsightsTiming
        hourSeries={hourSeries}
        timing={insights.timing}
        weekdayBars={weekdayBars}
      />
      <InsightsQuality
        lagBars={lagBars}
        paymentMethods={insights.paymentMethods}
        valueDates={insights.valueDates}
      />
      <InsightsAccounts accountBars={accountBars} insights={insights} />
    </AnalyticsPage>
  );
}
