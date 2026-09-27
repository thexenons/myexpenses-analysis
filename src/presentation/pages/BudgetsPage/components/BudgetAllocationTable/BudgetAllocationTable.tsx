import { AccordionTree } from "../../../../components/organisms/AccordionTree/index.ts";
import { BudgetAllocationItem } from "./BudgetAllocationTable.Item.tsx";
import styles from "./BudgetAllocationTable.module.css";
import type { BudgetAllocationTableProps } from "./BudgetAllocationTable.types.ts";

export function BudgetAllocationTable({
  allocations,
  currency,
  fractionDigits,
  isFilteredComparison = false,
  onInspectConsumption,
}: BudgetAllocationTableProps) {
  if (allocations.length === 0) {
    return <p className={styles.empty}>Este periodo no tiene asignaciones por categoría.</p>;
  }

  return (
    <AccordionTree aria-label="Asignaciones jerárquicas del presupuesto">
      {allocations.map((allocation) => (
        <BudgetAllocationItem
          allocation={allocation}
          currency={currency}
          depth={0}
          fractionDigits={fractionDigits}
          isFilteredComparison={isFilteredComparison}
          onInspectConsumption={onInspectConsumption}
          key={allocation.id}
        />
      ))}
    </AccordionTree>
  );
}
