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
  const expense = category.expenseComposition;
  const hasExpenseActivity = expense.grossExpensesEurMinor !== 0 || expense.expenseRefundsEurMinor !== 0 || expense.debtExpenseAdjustmentsEurMinor !== 0;

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

          <div className={styles.details}>
            <div className={styles.metadata}>
              <Badge tone={categoryTypeTone(category.categoryType)}>
                {CATEGORY_TYPE_LABELS[category.categoryType]}
              </Badge>
              <span className={styles.counts}>
                {countFormatter.format(category.directSummary.postingCount)} dir.
                {" / "}
                {countFormatter.format(category.summary.postingCount)} total
              </span>
            </div>
            {hasExpenseActivity ? (
              <details className={styles.composition}>
                <summary className={styles.compositionSummary}>Desglose del gasto</summary>
                <div className={styles.compositionPanel}>
                  <p className={styles.compositionScope}>Importes de la selección{category.children.length > 0 ? ", incluidas las subcategorías" : ""}. El gasto neto conserva el signo de la perspectiva seleccionada.</p>
                  <dl className={styles.compositionValues}>
                    <div><dt>Gasto bruto</dt><dd>{formatEuroMinor(expense.grossExpensesEurMinor)}</dd></div>
                    <div><dt>Devoluciones</dt><dd>{formatEuroMinor(expense.expenseRefundsEurMinor)}</dd></div>
                    {expense.debtExpenseAdjustmentsEurMinor !== 0 ? (
                      <div><dt>Ajuste por deuda</dt><dd>{formatEuroMinor(expense.debtExpenseAdjustmentsEurMinor)}</dd></div>
                    ) : null}
                    <div className={styles.compositionTotal}><dt>Gasto neto seleccionado</dt><dd>{formatEuroMinor(expense.netExpenseConsumptionEurMinor)}</dd></div>
                  </dl>
                  {expense.debtExpenseAdjustmentsEurMinor !== 0 ? (
                    <p className={styles.compositionScope}>El ajuste por deuda corresponde a una contrapartida verificada; no es una devolución. Gasto bruto − devoluciones − ajuste = gasto neto seleccionado.</p>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>

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
