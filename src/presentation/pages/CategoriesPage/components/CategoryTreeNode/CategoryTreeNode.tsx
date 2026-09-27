import { Badge } from "../../../../components/atoms/Badge/index.ts";
import { AccordionTreeItem } from "../../../../components/organisms/AccordionTree/index.ts";
import {
  countFormatter,
  formatCategoryPath,
  formatEuroMinor,
} from "../../../../utils/format.ts";
import {
  CATEGORY_TYPE_LABELS,
  categoryTypeTone,
  categoryBranchContainsSelection,
} from "./CategoryTreeNode.helpers.ts";
import styles from "./CategoryTreeNode.module.css";
import type { CategoryTreeNodeProps } from "./CategoryTreeNode.types.ts";

const UNIT_LABELS = { day: "día", week: "semana", month: "mes", year: "año" } as const;

export function CategoryTreeNode({
  category,
  averageEurMinorByCategoryId,
  averageUnit,
  averageScope,
  completedPeriodCount,
  depth,
  onToggleCategory,
  selectedCategoryIds,
}: CategoryTreeNodeProps) {
  const selected = selectedCategoryIds.has(category.id);
  const pathLabel = formatCategoryPath(category.path);
  const averageEurMinor = completedPeriodCount === 0
    ? null
    : averageEurMinorByCategoryId.get(category.id) ?? 0;

  return (
    <AccordionTreeItem
      header={
        <>
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
                : `${averageScope === "historical" ? "Promedio histórico" : "Promedio"}: ${formatEuroMinor(averageEurMinor)}/${UNIT_LABELS[averageUnit]} · ${completedPeriodCount} ${completedPeriodCount === 1 ? "período completo" : "períodos completos"}`}
            </span>
          </span>
        </>
      }
      initialExpanded={
        depth === 0 || categoryBranchContainsSelection(category, selectedCategoryIds)
      }
      label={pathLabel}
      rowClassName={styles.row}
    >
      {category.children.length > 0
        ? category.children.map((child) => (
            <CategoryTreeNode
              category={child}
              averageEurMinorByCategoryId={averageEurMinorByCategoryId}
              averageUnit={averageUnit}
              averageScope={averageScope}
              completedPeriodCount={completedPeriodCount}
              depth={depth + 1}
              key={child.id}
              onToggleCategory={onToggleCategory}
              selectedCategoryIds={selectedCategoryIds}
            />
          ))
        : null}
    </AccordionTreeItem>
  );
}
