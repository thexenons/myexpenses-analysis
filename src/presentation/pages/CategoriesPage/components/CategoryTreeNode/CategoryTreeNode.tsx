import { Badge } from "../../../../components/atoms/Badge/index.ts";
import { Icon } from "../../../../components/atoms/Icon/index.ts";
import {
  countFormatter,
  formatCategoryPath,
  formatEuroMinor,
} from "../../../../utils/format.ts";
import {
  CATEGORY_TYPE_LABELS,
  categoryTypeTone,
} from "./CategoryTreeNode.helpers.ts";
import styles from "./CategoryTreeNode.module.css";
import type { CategoryTreeNodeProps } from "./CategoryTreeNode.types.ts";
import { useCategoryTreeNode } from "./hooks/CategoryTreeNode.hooks.ts";

const UNIT_LABELS = { day: "día", week: "semana", month: "mes", year: "año" } as const;

export function CategoryTreeNode({
  category,
  averageEurMinorByCategoryId,
  averageUnit,
  completedPeriodCount,
  depth,
  onToggleCategory,
  selectedCategoryIds,
}: CategoryTreeNodeProps) {
  const {
    childrenId,
    expanded,
    hasChildren,
    onToggleExpanded,
    selected,
  } = useCategoryTreeNode({ category, depth, selectedCategoryIds });
  const pathLabel = formatCategoryPath(category.path);
  const averageEurMinor = completedPeriodCount === 0
    ? null
    : averageEurMinorByCategoryId.get(category.id) ?? 0;

  return (
    <li className={styles.node}>
      <div className={styles.row}>
        {hasChildren ? (
          <button
            aria-controls={childrenId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Contraer" : "Desplegar"} ${pathLabel}`}
            className={styles.disclosure}
            onClick={onToggleExpanded}
            type="button"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        ) : (
          <span aria-hidden="true" className={styles.leafMark} />
        )}

        <button
          aria-label={`${selected ? "Quitar filtro" : "Filtrar"}: ${pathLabel}`}
          aria-pressed={selected}
          className={styles.selection}
          onClick={() => onToggleCategory(category.path)}
          type="button"
        >
          <span className={styles.name}>{category.name}</span>
          <span className={styles.path}>{pathLabel}</span>
        </button>

        <span className={styles.details}>
          <Badge tone={categoryTypeTone(category.categoryType)}>
            {CATEGORY_TYPE_LABELS[category.categoryType]}
          </Badge>
          <span className={styles.counts}>
            {countFormatter.format(category.directSummary.postingCount)} dir.
            {" / "}
            {countFormatter.format(category.summary.postingCount)} total
          </span>
        </span>

        <span className={styles.amount}>
          <span>{formatEuroMinor(category.summary.netEurMinor)}</span>
          <span className={styles.average}>
            {averageEurMinor === null
              ? "Sin períodos completos"
              : `Promedio: ${formatEuroMinor(averageEurMinor)}/${UNIT_LABELS[averageUnit]}`}
          </span>
        </span>
      </div>

      {hasChildren && expanded ? (
        <ul className={styles.children} id={childrenId}>
          {category.children.map((child) => (
            <CategoryTreeNode
              category={child}
              averageEurMinorByCategoryId={averageEurMinorByCategoryId}
              averageUnit={averageUnit}
              completedPeriodCount={completedPeriodCount}
              depth={depth + 1}
              key={child.id}
              onToggleCategory={onToggleCategory}
              selectedCategoryIds={selectedCategoryIds}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
