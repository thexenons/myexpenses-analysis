import { Badge } from "../../components/atoms/Badge/index.ts";
import { Button } from "../../components/atoms/Button/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { KpiCard } from "../../components/molecules/KpiCard/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { HorizontalBarChart } from "../../components/organisms/HorizontalBarChart/index.ts";
import { LineChart } from "../../components/organisms/LineChart/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { AnalyticsPageGrid } from "../../components/templates/AnalyticsPageGrid/index.ts";
import type { CategoryType } from "../../../domain/analytics/types.ts";
import {
  countFormatter,
  euroFormatter,
  euroFromMinor,
  formatEuroMinor,
  formatPeriodLabel,
} from "../../utils/format.ts";
import styles from "./CategoriesPage.module.css";
import type { CategoriesPageViewProps } from "./CategoriesPage.types.ts";

const CATEGORY_TYPE_LABELS: Readonly<Record<CategoryType, string>> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  NEUTRAL: "Neutral",
  TRANSFER: "Transferencia",
};

export function CategoriesPageView({
  activityEurMinor,
  categoryBars,
  categorySeries,
  directPostingCount,
  expenseEurMinor,
  flattenedCategories,
  onClearCategory,
  onSelectCategory,
  selectedCategory,
  showClearCategory,
}: CategoriesPageViewProps) {
  return (
    <AnalyticsPage
      description="Navega por el árbol contable y convierte cualquier ruta en filtro global. Los padres incluyen toda la actividad de sus descendientes."
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
            selectedCategory
              ? selectedCategory.path.join(" › ")
              : "Árbol completo"
          }
          formatValue={euroFormatter}
          icon={<Icon name="category" />}
          label="Actividad seleccionada"
          tone="info"
          value={euroFromMinor(activityEurMinor)}
        />
        <KpiCard
          detail="Incluye descendientes"
          formatValue={euroFormatter}
          icon={<Icon name="receipt" />}
          label="Gasto de la selección"
          tone="negative"
          value={euroFromMinor(expenseEurMinor)}
        />
        <KpiCard
          detail="Rutas con actividad"
          formatValue={countFormatter}
          icon={<Icon name="trend" />}
          label="Categorías visibles"
          tone="accent"
          value={flattenedCategories.length}
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

      <AnalyticsPageGrid variant="two">
        <Panel className={styles.chartPanel}>
          <HorizontalBarChart
            data={categoryBars}
            description="Importe neto absoluto para comparar peso relativo."
            formatValue={euroFormatter}
            labelHeader="Categoría"
            title="Peso de las categorías"
          />
        </Panel>
        <Panel className={styles.chartPanel}>
          <LineChart
            description="Evolución de las cuatro raíces con más actividad."
            formatLabel={formatPeriodLabel}
            formatValue={euroFormatter}
            series={categorySeries}
            title="Evolución comparada"
          />
        </Panel>
      </AnalyticsPageGrid>

      <Panel
        description="Selecciona una ruta para aplicarla a toda la aplicación"
        title="Explorador jerárquico"
      >
        <div className={styles.categoryTree}>
          {flattenedCategories.map((category) => (
            <button
              className={styles.categoryNode}
              key={category.id}
              onClick={() => onSelectCategory(category.path)}
              type="button"
            >
              <span>
                <span className={styles.categoryName}>{category.name}</span>
                <span className={styles.categoryPath}>
                  {category.path.join(" › ")}
                </span>
              </span>
              <span className={styles.categoryDetails}>
                <Badge
                  tone={
                    category.categoryType === "EXPENSE"
                      ? "negative"
                      : category.categoryType === "INCOME"
                        ? "positive"
                        : "info"
                  }
                >
                  {CATEGORY_TYPE_LABELS[category.categoryType]}
                </Badge>
                <span className={styles.categoryCounts}>
                  {countFormatter.format(category.directSummary.postingCount)} dir.
                  {" / "}
                  {countFormatter.format(category.summary.postingCount)} total
                </span>
              </span>
              <span className={styles.categoryAmount}>
                {formatEuroMinor(category.summary.netEurMinor)}
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </AnalyticsPage>
  );
}
