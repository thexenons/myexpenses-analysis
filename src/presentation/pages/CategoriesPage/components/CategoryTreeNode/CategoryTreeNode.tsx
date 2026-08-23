import { Badge } from "../../../../components/atoms/Badge/index.ts";
import { Icon } from "../../../../components/atoms/Icon/index.ts";
import {
  countFormatter,
  formatEuroMinor,
} from "../../../../utils/format.ts";
import {
  CATEGORY_TYPE_LABELS,
  categoryTypeTone,
} from "./CategoryTreeNode.helpers.ts";
import styles from "./CategoryTreeNode.module.css";
import type { CategoryTreeNodeProps } from "./CategoryTreeNode.types.ts";
import { useCategoryTreeNode } from "./hooks/CategoryTreeNode.hooks.ts";

export function CategoryTreeNode({
  category,
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
  const pathLabel = category.path.join(" › ");

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
          {formatEuroMinor(category.summary.netEurMinor)}
        </span>
      </div>

      {hasChildren && expanded ? (
        <ul className={styles.children} id={childrenId}>
          {category.children.map((child) => (
            <CategoryTreeNode
              category={child}
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
