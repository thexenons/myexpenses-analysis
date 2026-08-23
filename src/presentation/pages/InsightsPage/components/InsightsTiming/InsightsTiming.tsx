import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { HorizontalBarChart } from "../../../../components/organisms/HorizontalBarChart/HorizontalBarChart.tsx";
import { LineChart } from "../../../../components/organisms/LineChart/LineChart.tsx";
import { AnalyticsPageGrid } from "../../../../components/templates/AnalyticsPageGrid/AnalyticsPageGrid.tsx";
import { countFormatter } from "../../../../utils/format.ts";
import styles from "./InsightsTiming.module.css";
import type { InsightsTimingProps } from "./InsightsTiming.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function InsightsTiming({
  hourSeries,
  timing,
  weekdayBars,
}: InsightsTimingProps) {
  return (
    <AnalyticsPageGrid variant="two">
      <Panel
        aria-label="Patrón por hora local"
        actions={
          <Badge tone="info">
            {percentageFormatter.format(timing.hourCoverageRatio)} cobertura
          </Badge>
        }
        className={`${styles.chartPanel} ${styles.deferredPanel}`}
      >
        <LineChart
          description={`${countFormatter.format(timing.timedPostingCount)} apuntes conservan una hora distinta de 00:00. Los anulados permanecen en el conteo; su importe es cero en agregados.`}
          formatValue={countFormatter}
          series={hourSeries}
          title="Ritmo por hora local"
        />
      </Panel>
      <Panel
        aria-label="Patrón por día de la semana"
        className={`${styles.chartPanel} ${styles.deferredPanel}`}
      >
        <HorizontalBarChart
          data={weekdayBars}
          description="Número de apuntes por día local de la semana dentro del filtro actual."
          formatValue={countFormatter}
          labelHeader="Día"
          title="Distribución semanal"
        />
      </Panel>
    </AnalyticsPageGrid>
  );
}
