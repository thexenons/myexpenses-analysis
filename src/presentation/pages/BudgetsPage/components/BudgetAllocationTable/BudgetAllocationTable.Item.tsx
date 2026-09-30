import { useId, useState } from "react";

import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";
import type { BudgetCategoryComparison, BudgetPeriodComparison } from "../../../../../domain/analytics/budget-period-comparison.ts";
import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { AccordionTreeItem } from "../../../../components/organisms/AccordionTree/index.ts";
import { formatBudgetComparisonDelta, formatBudgetMinor } from "../../BudgetsPage.helpers.ts";
import { formatDate } from "../../../../utils/format.ts";
import { BudgetUtilization } from "../BudgetUtilization/BudgetUtilization.tsx";
import { HEALTH_LABELS, HEALTH_TONES, SOURCE_LABELS } from "./BudgetAllocationTable.helpers.tsx";
import styles from "./BudgetAllocationTable.module.css";

export function BudgetAllocationItem({
  allocation,
  comparison,
  categoryComparisons,
  currency,
  fractionDigits,
  isFilteredComparison,
  onInspectConsumption,
  depth,
}: {
  readonly allocation: BudgetAllocationNode;
  readonly comparison: BudgetPeriodComparison | null;
  readonly categoryComparisons: ReadonlyMap<string, BudgetCategoryComparison>;
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
  const categoryComparison = categoryComparisons.get(allocation.categoryUuid);
  const primary = categoryComparison?.references.find((reference) => reference.referenceKey === comparison?.primaryReferenceKey);
  const primaryAmount = primary?.consumedMinor ?? null;
  const referenceDelta = primary?.deltaMinor ?? null;
  const meanAmount = comparison?.mean.status === "ready" ? categoryComparison?.mean.averageMinor ?? null : null;
  const elapsed = comparison?.elapsed?.references.find((reference) => reference.referenceKey === comparison.primaryReferenceKey);
  const elapsedCategory = elapsed?.categories.find((category) => category.categoryUuid === allocation.categoryUuid);
  const signal = allocation.health === "exceeded" && !isFilteredComparison || primaryAmount === null || primaryAmount <= 0 || referenceDelta === null
    ? null : referenceDelta > 0
      ? `${formatBudgetMinor(referenceDelta, currency, fractionDigits)} más que la referencia`
      : allocation.consumedMinor >= primaryAmount * 0.9 && allocation.consumedMinor < primaryAmount && allocation.consumedMinor >= 0
        ? `A ${formatBudgetMinor(-referenceDelta, currency, fractionDigits)} de igualarla`
        : null;

  const amountMetric = (
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
  );
  const utilizationMetric = (
    <div className={styles.utilization}>
      <BudgetUtilization
        accessibleLabel={`${isFilteredComparison ? "Utilización del corte de" : "Utilización de"} ${pathLabel}`}
        health={isFilteredComparison ? "unallocated" : allocation.health}
        label={isFilteredComparison ? "Utilización del corte" : "Utilización"}
        utilization={allocation.utilization}
        variant="inline"
      />
    </div>
  );

  return (
    <AccordionTreeItem
      header={
        <div className={styles.content}>
          <div className={`${styles.summary} ${comparison === null ? "" : styles.summaryWithComparison}`}>
            <div className={styles.category}>
              <strong className={styles.categoryName}>{allocation.name}</strong>
              {!isFilteredComparison && allocation.health === "exceeded" ? (
                <Badge tone="negative">Excedido</Badge>
              ) : null}
            </div>
            {comparison === null ? <>{amountMetric}{utilizationMetric}</> : (
              <>
                <div className={styles.currentBlock}>
                  {amountMetric}
                  {utilizationMetric}
                  {signal === null ? null : <span className={styles.signal}>{signal}</span>}
                </div>
                <dl className={styles.referenceMetric}>
                  <div className={styles.metric}>
                    <dt>Referencia</dt>
                    <dd>{comparison.primaryReferenceKey === null ? "Sin referencia" : primaryAmount === null ? "Sin datos" : formatBudgetMinor(primaryAmount, currency, fractionDigits)}</dd>
                  </div>
                </dl>
                <dl className={styles.meanMetric}>
                  <div className={styles.metric}>
                    <dt>Media</dt>
                    <dd>{meanAmount === null ? comparison.mean.status === "unsupported-grouping" ? "Sin unidad" : "Sin historial" : formatBudgetMinor(meanAmount, currency, fractionDigits)}</dd>
                  </div>
                </dl>
              </>
            )}
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
            {comparison === null ? null : (
              <>
                <div className={`${styles.metric} ${styles.wideMetric}`}>
                  <dt>Referencias completas</dt>
                  <dd>
                    {comparison.references.length === 0 ? "Sin referencias seleccionadas" : (
                      <ul className={styles.referenceList}>
                        {comparison.references.map((reference) => {
                          const value = categoryComparison?.references.find((entry) => entry.referenceKey === reference.range.key);
                          return (
                            <li key={reference.range.key}>
                              <span>{reference.range.label}</span>
                              <span>{value?.consumedMinor === null || value?.consumedMinor === undefined ? "Sin datos completos" : formatBudgetMinor(value.consumedMinor, currency, fractionDigits)}</span>
                              <span>{formatBudgetComparisonDelta(value?.deltaMinor ?? null, value?.percentChange ?? null, currency, fractionDigits)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className={styles.metric}>
                  <dt>Media histórica</dt>
                  <dd>{meanAmount === null ? comparison.mean.status === "unsupported-grouping" ? "Sin media para intervalo libre" : "Sin historial completo" :
                    `${formatBudgetMinor(meanAmount, currency, fractionDigits)} · ${formatBudgetComparisonDelta(categoryComparison?.mean.deltaMinor ?? null, categoryComparison?.mean.percentChange ?? null, currency, fractionDigits)}`}</dd>
                </div>
                {elapsed === undefined ? null : (
                  <div className={`${styles.metric} ${styles.wideMetric}`}>
                    <dt>Mismo tramo transcurrido</dt>
                    <dd>{elapsed.status === "unavailable" || elapsed.currentRange === null || elapsed.referenceRange === null || elapsedCategory === undefined || elapsedCategory.currentConsumedMinor === null || elapsedCategory.referenceConsumedMinor === null ? "No hay días comparables con cobertura completa." : (
                      <span>{formatDate(elapsed.currentRange.from)} – {formatDate(elapsed.currentRange.to)}: {formatBudgetMinor(elapsedCategory.currentConsumedMinor, currency, fractionDigits)} / {formatDate(elapsed.referenceRange.from)} – {formatDate(elapsed.referenceRange.to)}: {formatBudgetMinor(elapsedCategory.referenceConsumedMinor, currency, fractionDigits)} · {formatBudgetComparisonDelta(elapsedCategory.deltaMinor, elapsedCategory.percentChange, currency, fractionDigits)}</span>
                    )}</dd>
                  </div>
                )}
              </>
            )}
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
          comparison={comparison}
          categoryComparisons={categoryComparisons}
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
