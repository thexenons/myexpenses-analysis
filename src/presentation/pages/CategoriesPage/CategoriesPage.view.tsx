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
  formatPeriodLabel,
} from "../../utils/format.ts";
import { CategoryTreeNode } from "./components/CategoryTreeNode/index.ts";
import styles from "./CategoriesPage.module.css";
import type { CategoriesPageViewProps } from "./CategoriesPage.types.ts";

export function CategoriesPageView({
  activityEurMinor,
  categoryBars,
  categoryCount,
  categorySeries,
  categoryTree,
  directPostingCount,
  expenseEurMinor,
  onClearCategory,
  onToggleCategory,
  selectedCategoryIds,
  selectionDetail,
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
            selectionDetail
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
        description="Despliega ramas y combina varias rutas en el filtro global"
        title="Explorador jerárquico"
      >
        {categoryTree.length === 0 ? (
          <EmptyState
            description="Amplía el periodo o revisa los filtros que limitan la actividad."
            icon={<Icon name="category" />}
            title="No hay categorías con actividad"
          />
        ) : (
          <ul className={styles.categoryTree}>
          {categoryTree.map((category) => (
            <CategoryTreeNode
              category={category}
              depth={0}
              key={category.id}
              onToggleCategory={onToggleCategory}
              selectedCategoryIds={selectedCategoryIds}
            />
          ))}
          </ul>
        )}
      </Panel>
    </AnalyticsPage>
  );
}
