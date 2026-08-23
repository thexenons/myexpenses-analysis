import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { ChartDataTable } from "../../../../components/organisms/ChartDataTable/ChartDataTable.tsx";
import { HorizontalBarChart } from "../../../../components/organisms/HorizontalBarChart/HorizontalBarChart.tsx";
import {
  countFormatter,
  formatDate,
  formatEuroMinor,
} from "../../../../utils/format.ts";
import styles from "./InsightsQuality.module.css";
import type { InsightsQualityProps } from "./InsightsQuality.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function InsightsQuality({
  lagBars,
  paymentMethods,
  valueDates,
}: InsightsQualityProps) {
  const distinctRange =
    valueDates.distinctValueDateFrom === null ||
    valueDates.distinctValueDateTo === null
      ? "Sin fechas valor distintas"
      : `${formatDate(valueDates.distinctValueDateFrom)} – ${formatDate(valueDates.distinctValueDateTo)}`;

  return (
    <div
      className={styles.qualityGrid}
      data-single={paymentMethods.usedPostingCount === 0}
    >
      <Panel
        actions={
          <Badge tone="accent">
            {percentageFormatter.format(valueDates.coverageRatio)} con fecha valor
          </Badge>
        }
        className={`${styles.qualityPanel} ${styles.deferredPanel}`}
        description={`Fecha efectiva, incluida la heredada del padre split. Rango de las fechas distintas: ${distinctRange}.`}
        title="Operación frente a fecha valor"
      >
        <div className={styles.qualityMetrics}>
          <div>
            <span>Con fecha valor</span>
            <strong>{countFormatter.format(valueDates.valueDatePostingCount)}</strong>
          </div>
          <div>
            <span>Distinta de operación</span>
            <strong>{countFormatter.format(valueDates.distinctValueDateCount)}</strong>
          </div>
          <div>
            <span>Mismo día</span>
            <strong>{countFormatter.format(valueDates.sameDayValueDateCount)}</strong>
          </div>
          <div>
            <span>Sin fecha valor</span>
            <strong>{countFormatter.format(valueDates.missingValueDateCount)}</strong>
          </div>
        </div>
        <div className={styles.lagChart}>
          <HorizontalBarChart
            data={lagBars}
            description="Conteo agrupado por días entre la fecha de operación y la fecha valor."
            formatValue={countFormatter}
            labelHeader="Desfase"
            title="Bandas de desfase"
          />
        </div>
        <ChartDataTable
          caption="Distribución exacta del desfase de fecha valor"
          columns={[{ id: "postings", label: "Apuntes" }]}
          formatValue={countFormatter}
          labelHeader="Días"
          rows={() =>
            valueDates.lagDistribution.map((item) => ({
              id: String(item.lagDays),
              label:
                item.lagDays === 0
                  ? "Mismo día"
                  : `${item.lagDays > 0 ? "+" : ""}${item.lagDays} días`,
              values: [item.postingCount],
            }))
          }
          summary="Ver desfases exactos"
        />
      </Panel>

      {paymentMethods.usedPostingCount > 0 ? (
        <Panel
          actions={
            <Badge tone="neutral">
              {paymentMethods.usedMethodCount} de{" "}
              {paymentMethods.definedMethodCount} usados
            </Badge>
          }
          className={styles.deferredPanel}
          description="Se muestra de forma compacta porque este campo apenas aparece en los apuntes del corte."
          title="Métodos de pago"
        >
          <div className={styles.methodHero}>
            <strong>{countFormatter.format(paymentMethods.usedPostingCount)}</strong>
            <span>
              de {countFormatter.format(paymentMethods.activePostingCount)} apuntes
              activos
            </span>
          </div>
          <ul className={styles.methodList}>
            {paymentMethods.methods.map((method) => (
              <li key={method.name}>
                <span>
                  <strong>{method.name}</strong>
                  <small>{countFormatter.format(method.postingCount)} usos</small>
                </span>
                <strong>{formatEuroMinor(method.netEurMinor)}</strong>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
