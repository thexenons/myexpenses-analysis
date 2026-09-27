import { AccordionTreeItem } from "../../components/organisms/AccordionTree/index.ts";
import { formatCategoryPath, formatEuroMinor } from "../../utils/format.ts";
import type { CategoryMetric, PerspectiveCategoryRow } from "./PerspectiveComparisonPage.helpers.ts";
import { SCOPE_LABELS } from "./PerspectiveComparisonPage.labels.ts";
import styles from "./PerspectiveComparisonPage.module.css";

export function ComparisonCategoryNode({
  category,
  depth,
  metric,
}: {
  readonly category: PerspectiveCategoryRow;
  readonly depth: number;
  readonly metric: CategoryMetric;
}) {
  const label = category.path.length === 0
    ? "Sin categoría (sin asignar)"
    : formatCategoryPath(category.path);
  return (
    <AccordionTreeItem
      header={
        <>
          <span className={styles.categoryName}>{label}</span>
          <dl className={styles.categoryValues}>
            {(["realCashFlow", "all", "debtsOnly"] as const).map((scope) => (
              <div className={styles.categoryValue} key={scope}>
                <dt>{SCOPE_LABELS[scope]}</dt>
                <dd>{formatEuroMinor(category.amounts[scope][metric])}</dd>
              </div>
            ))}
          </dl>
        </>
      }
      initialExpanded={depth === 0}
      label={label}
      rowClassName={styles.categoryRow}
    >
      {category.children.map((child) => (
        <ComparisonCategoryNode category={child} depth={depth + 1} key={child.id} metric={metric} />
      ))}
    </AccordionTreeItem>
  );
}
