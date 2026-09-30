import { useId, useState } from "react";

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
  onInspectConsumption,
  depth,
}: {
  readonly allocation: BudgetAllocationNode;
  readonly currency: string;
  readonly fractionDigits: number;
  readonly isFilteredComparison: boolean;
  readonly onInspectConsumption?: (path: readonly string[], label: string, trigger: HTMLButtonElement) => void;
  readonly depth: number;
}) {
  const pathLabel = allocation.path.join(" › ");
  const availableLabel = isFilteredComparison ? "Asignado menos corte" : "Disponible";
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <AccordionTreeItem
      header={
        <div className={styles.content}>
          <div className={styles.summary}>
            <div className={styles.category}>
              <strong className={styles.categoryName}>{allocation.name}</strong>
              {!isFilteredComparison && allocation.health === "exceeded" ? (
                <Badge tone="negative">Excedido</Badge>
              ) : null}
            </div>
            <dl className={styles.primaryMetrics}>
              <div className={styles.metric}>
                <dt><span>Consumido</span> / <span>Asignado</span></dt>
                <dd className={styles.amountPair}>
                  {onInspectConsumption === undefined ? formatBudgetMinor(allocation.consumedMinor, currency, fractionDigits) : (
                    <button
                      aria-label={`Ver apuntes consumidos de ${pathLabel}: ${formatBudgetMinor(allocation.consumedMinor, currency, fractionDigits)}`}
                      className={styles.inspectButton}
                      onClick={(event) => onInspectConsumption(allocation.path, pathLabel, event.currentTarget)}
                      type="button"
                    >
                      {formatBudgetMinor(allocation.consumedMinor, currency, fractionDigits)}
                    </button>
                  )}
                  <span className={styles.assignedAmount}>
                    <span aria-hidden="true">/ </span>
                    {formatBudgetMinor(allocation.assignedMinor, currency, fractionDigits)}
                  </span>
                </dd>
              </div>
            </dl>
            <div className={styles.utilization}>
              <BudgetUtilization
                accessibleLabel={`${isFilteredComparison ? "Utilización del corte de" : "Utilización de"} ${pathLabel}`}
                health={isFilteredComparison ? "unallocated" : allocation.health}
                label={isFilteredComparison ? "Utilización del corte" : "Utilización"}
                utilization={allocation.utilization}
                variant="inline"
              />
            </div>
            <button
              aria-controls={detailsId}
              aria-expanded={detailsOpen}
              aria-label={`Detalles de ${pathLabel}`}
              className={styles.detailsToggle}
              onClick={() => setDetailsOpen((open) => !open)}
              type="button"
            >
              Detalles
            </button>
          </div>
          <dl className={styles.metrics} hidden={!detailsOpen} id={detailsId}>
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
              <dt>{availableLabel}</dt>
              <dd>
                <strong className={styles[isFilteredComparison ? "unallocatedAmount" : `${allocation.health}Amount`]}>
                  {formatBudgetMinor(allocation.availableMinor, currency, fractionDigits)}
                </strong>
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
        </div>
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
          onInspectConsumption={onInspectConsumption}
          key={child.id}
        />
      ))}
    </AccordionTreeItem>
  );
}
