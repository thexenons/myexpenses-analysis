import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";
import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { AccordionTreeItem } from "../../../../components/organisms/AccordionTree/index.ts";
import { formatBudgetMinor } from "../../BudgetsPage.helpers.ts";
import { BudgetUtilization } from "../BudgetUtilization/BudgetUtilization.tsx";
import { HEALTH_LABELS, HEALTH_TONES, SOURCE_LABELS } from "./BudgetAllocationTable.helpers.tsx";
import styles from "./BudgetAllocationTable.module.css";

export function BudgetAllocationItem({
  allocation,
  currency,
  fractionDigits,
  isFilteredComparison,
  depth,
}: {
  readonly allocation: BudgetAllocationNode;
  readonly currency: string;
  readonly fractionDigits: number;
  readonly isFilteredComparison: boolean;
  readonly depth: number;
}) {
  const pathLabel = allocation.path.join(" › ");
  const availableLabel = isFilteredComparison ? "Asignado menos corte" : "Disponible";

  return (
    <AccordionTreeItem
      header={
        <>
          <div className={styles.category}>
            <strong className={styles.categoryName}>{allocation.name}</strong>
            <span className={styles.path}>{pathLabel}</span>
          </div>
          <dl className={styles.metrics}>
            <div className={styles.metric}>
              <dt>Origen</dt>
              <dd className={styles.badges}>
                <Badge tone={allocation.allocationSource === "FALLBACK" ? "warning" : "info"}>
                  {SOURCE_LABELS[allocation.allocationSource]}
                </Badge>
                {allocation.oneTime ? <Badge tone="accent">Única</Badge> : null}
              </dd>
            </div>
            <div className={styles.metric}>
              <dt>Asignado</dt>
              <dd>{formatBudgetMinor(allocation.assignedMinor, currency, fractionDigits)}</dd>
            </div>
            <div className={styles.metric}>
              <dt>Arrastre</dt>
              <dd className={styles.rollover}>
                <span>{formatBudgetMinor(allocation.rolloverPreviousMinor, currency, fractionDigits)}</span>
                {allocation.rolloverNextMinor !== 0 ? (
                  <span className={styles.nextRollover}>
                    sig. {formatBudgetMinor(allocation.rolloverNextMinor, currency, fractionDigits)}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className={styles.metric}>
              <dt>Consumido</dt>
              <dd>{formatBudgetMinor(allocation.consumedMinor, currency, fractionDigits)}</dd>
            </div>
            <div className={styles.metric}>
              <dt>{availableLabel}</dt>
              <dd>
                <strong className={styles[isFilteredComparison ? "unallocatedAmount" : `${allocation.health}Amount`]}>
                  {formatBudgetMinor(allocation.availableMinor, currency, fractionDigits)}
                </strong>
              </dd>
            </div>
            <div className={styles.metric}>
              <dt>Utilización</dt>
              <dd>
                <BudgetUtilization
                  health={isFilteredComparison ? "unallocated" : allocation.health}
                  label={`${isFilteredComparison ? "Utilización del corte de" : "Utilización de"} ${pathLabel}`}
                  utilization={allocation.utilization}
                />
              </dd>
            </div>
            <div className={styles.metric}>
              <dt>Estado</dt>
              <dd>
                <Badge tone={isFilteredComparison ? "info" : HEALTH_TONES[allocation.health]}>
                  {isFilteredComparison ? "Corte filtrado" : HEALTH_LABELS[allocation.health]}
                </Badge>
              </dd>
            </div>
          </dl>
        </>
      }
      initialExpanded={depth === 0}
      label={pathLabel}
      rowClassName={styles.itemRow}
    >
      {allocation.children.map((child) => (
        <BudgetAllocationItem
          allocation={child}
          currency={currency}
          depth={depth + 1}
          fractionDigits={fractionDigits}
          isFilteredComparison={isFilteredComparison}
          key={child.id}
        />
      ))}
    </AccordionTreeItem>
  );
}
