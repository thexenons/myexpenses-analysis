import { Button } from "../../components/atoms/Button/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { EmptyState } from "../../components/molecules/EmptyState/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { HorizontalBarChart } from "../../components/organisms/HorizontalBarChart/index.ts";
import { AccordionTree } from "../../components/organisms/AccordionTree/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import {
  countFormatter,
  euroFormatter,
  euroFromMinor,
  formatPeriodLabel,
} from "../../utils/format.ts";
import { CategoryTreeNode } from "./components/CategoryTreeNode/index.ts";
import { CATEGORY_METRIC_LABELS, DEFAULT_CATEGORY_CHART_OPTIONS } from "./CategoriesPage.helpers.ts";
import chartStyles from "../../components/organisms/chart/chart.module.css";
import styles from "./CategoriesPage.module.css";
import type { CategoriesPageViewProps, CategoryLevel, CategoryMetric } from "./CategoriesPage.types.ts";

const AVERAGE_UNITS = {
  day: ["día", "días"],
  week: ["semana", "semanas"],
  month: ["mes", "meses"],
  year: ["año", "años"],
} as const;
const EXCLUSION_REASONS = {
  startsBeforeRange: "comienza antes del rango evaluado",
  endsAfterRange: "termina después del rango evaluado",
  currentOrFuture: "no terminó antes de hoy",
} as const;

function displayDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

export function CategoriesPageView({
  activityEurMinor,
  categoryBars,
  categoryCount,
  categoryAverageEurMinorById,
  categorySeries,
  categoryTree,
  completedPeriodCount,
  averageScope,
  averageUnit,
  averageExplanation,
  directPostingCount,
  expenseEurMinor,
  chartOptions = DEFAULT_CATEGORY_CHART_OPTIONS,
  onChartOptionsChange,
  onViewCategory,
  onViewTransactions,
  onViewPeriod,
  onClearCategory,
  onToggleCategory,
  selectedCategoryIds,
  selectionDetail,
  showClearCategory,
}: CategoriesPageViewProps) {
  const averageWindows = averageExplanation.fallbackReason === null
    ? [{ label: "Selección utilizada", window: averageExplanation.appliedWindow }]
    : [
      { label: "Selección no utilizada", window: averageExplanation.selectedWindow },
      { label: "Historial utilizado", window: averageExplanation.appliedWindow },
    ];
  const divisor = averageExplanation.appliedWindow.completedPeriodCount;
  const divisorUnit = AVERAGE_UNITS[averageUnit][divisor === 1 ? 0 : 1];

  return (
    <AnalyticsPage
      description="Compara categorías y convierte cualquier ruta en filtro global."
      introAction={
        showClearCategory ? (
          <Button onClick={onClearCategory} variant="secondary">
            Ver todas las categorías
          </Button>
        ) : undefined
      }
      title="Categorías"
    >
      <AnalyticsPageGrid variant="kpis">
        <KpiCard
          detail={
            selectionDetail
          }
          formatValue={euroFormatter}
          icon={<Icon name="category" />}
          label="Neto seleccionado"
          tone="info"
          value={euroFromMinor(activityEurMinor)}
        />
        <KpiCard
          detail="Negativo: abonos; no implica efectivo recuperado."
          formatValue={euroFormatter}
          icon={<Icon name="receipt" />}
          label="Gasto neto de la selección"
          tone={expenseEurMinor >= 0 ? "negative" : "info"}
          value={euroFromMinor(expenseEurMinor)}
        />
        <KpiCard
          detail="Rutas con actividad"
          formatValue={countFormatter}
          icon={<Icon name="trend" />}
          label="Categorías visibles"
          tone="accent"
          value={categoryCount}
        />
        <KpiCard
          detail="Asignados directamente"
          formatValue={countFormatter}
          icon={<Icon name="category" />}
          label="Apuntes directos"
          tone="cash"
          value={directPostingCount}
        />
      </AnalyticsPageGrid>

      <Panel
        description="Despliega ramas y combina varias rutas en el filtro global. El árbol muestra el neto total y el promedio por período completo; padres y descendientes no deben sumarse entre sí."
        title="Explorador jerárquico"
      >
        <details className={styles.averageExplanation}>
          <summary>Cómo se calcula el promedio</summary>
          <div className={styles.averageExplanationBody}>
            <p>
              Se divide el importe neto de cada categoría en las unidades incluidas
              entre un divisor común a todas las categorías. La selección de una
              categoría no cambia ese divisor. Se usa la {averageExplanation.dateBasis === "value" ? "fecha valor" : "fecha de operación"}.
            </p>
            {averageExplanation.fallbackReason === "selectedPeriodNeedsHistory" ? (
              <p>
                La unidad elegida coincide con el período seleccionado o lo supera;
                por eso se usa el historial como referencia en lugar de tomar sólo
                la selección. Se conservan los filtros no temporales.
              </p>
            ) : averageExplanation.fallbackReason === "noCompleteFilteredUnits" ? (
              <p>
                La selección no contiene unidades completas; se usa el historial
                disponible conservando los filtros no temporales.
              </p>
            ) : null}
            <p>{divisor === 0
              ? "Sin períodos completos: no se calcula ningún promedio."
              : `Divisor: ${divisor} ${divisorUnit} ${divisor === 1 ? "completo" : "completos"}, incluidos los períodos sin actividad.`}</p>
            {averageWindows.map(({ label, window: candidate }) => (
              <div className={styles.averageWindow} key={label}>
                <strong>{label}</strong>
                <p>Rango evaluado: {candidate.from === null || candidate.to === null
                  ? "sin fechas disponibles"
                  : `${displayDate(candidate.from)} — ${displayDate(candidate.to)}`}.</p>
                <p>Ventana incluida: {candidate.includedWindow === null
                  ? "ninguna"
                  : `${displayDate(candidate.includedWindow.from)} — ${displayDate(candidate.includedWindow.to)}`} ({candidate.completedPeriodCount} {candidate.completedPeriodCount === 1 ? "período completo" : "períodos completos"}).</p>
                {candidate.excludedPeriods.length > 0 ? (
                  <div>
                    <p>Unidades excluidas:</p>
                    <ul>
                      {candidate.excludedPeriods.map((period) => (
                        <li key={`${period.from}-${period.to}`}>
                          {displayDate(period.from)} — {displayDate(period.to)}: {period.reasons.map((reason) => EXCLUSION_REASONS[reason]).join(" y ")}.
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {candidate.futureExcluded ? <p>Los períodos futuros no se incluyen.</p> : null}
              </div>
            ))}
          </div>
        </details>
        {categoryTree.length === 0 ? (
          <EmptyState
            description="Amplía el periodo o revisa los filtros que limitan la actividad."
            icon={<Icon name="category" />}
            title="No hay categorías con actividad"
          />
        ) : (
          <AccordionTree>
            {categoryTree.map((category) => (
              <CategoryTreeNode
                category={category}
                averageEurMinorByCategoryId={categoryAverageEurMinorById}
                averageUnit={averageUnit}
                completedPeriodCount={completedPeriodCount}
                averageScope={averageScope}
                depth={0}
                key={category.id}
                onToggleCategory={onToggleCategory}
                selectedCategoryIds={selectedCategoryIds}
              />
            ))}
          </AccordionTree>
        )}
      </Panel>

      <Panel title="Consultar categorías" description="Elige la métrica y compara raíces o apuntes directos, sin duplicar importes.">
        <div className={chartStyles.controls}>
          <label className={chartStyles.control}>
            Métrica de categorías
            <select value={chartOptions.metric} onChange={(event) => onChartOptionsChange?.({ ...chartOptions, metric: event.target.value as CategoryMetric })}>
              {Object.entries(CATEGORY_METRIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={chartStyles.control}>
            Nivel de categorías
            <select value={chartOptions.level} onChange={(event) => onChartOptionsChange?.({ ...chartOptions, level: event.target.value as CategoryLevel })}>
              <option value="roots">Raíces o selección, con descendientes</option>
              <option value="direct">Rutas exactas, sólo apuntes directos</option>
            </select>
          </label>
          <label className={chartStyles.control}>
            Series comparadas{showClearCategory ? " (selección completa)" : ""}
            <select disabled={showClearCategory} value={chartOptions.seriesLimit} onChange={(event) => onChartOptionsChange?.({ ...chartOptions, seriesLimit: Number(event.target.value) })}>
              <option value={4}>Primeras 4</option>
              <option value={12}>Primeras 12</option>
              <option value={0}>Todas</option>
            </select>
          </label>
          {onViewTransactions ? <Button onClick={onViewTransactions} variant="secondary">Ver movimientos de la selección</Button> : null}
        </div>
        <p className={styles.help}>Activa u oculta series desde la leyenda.</p>
      </Panel>

      <AnalyticsPageGrid variant="two">
        <Panel className={styles.chartPanel}>
          <HorizontalBarChart
            data={categoryBars}
            description={`${CATEGORY_METRIC_LABELS[chartOptions.metric]}. Orden por importe absoluto; se conserva el signo.`}
            formatValue={euroFormatter}
            labelHeader="Categoría"
            onSelectDatum={onViewCategory}
            title="Peso de las categorías"
          />
        </Panel>
        <Panel className={styles.chartPanel}>
          <LineChart
            description={`${CATEGORY_METRIC_LABELS[chartOptions.metric]}. ${categorySeries.length} series; todas las seleccionadas están incluidas.`}
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            onSelectPeriod={onViewPeriod}
            series={categorySeries}
            title="Evolución comparada"
          />
        </Panel>
      </AnalyticsPageGrid>
    </AnalyticsPage>
  );
}
