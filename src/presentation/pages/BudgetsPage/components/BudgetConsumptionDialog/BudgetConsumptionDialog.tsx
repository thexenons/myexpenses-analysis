/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The named overflow region needs a durable Tab entry after the final batch removes its button. */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import type { BudgetContribution } from "../../../../../domain/analytics/budgets.ts";
import type { TransactionStatus } from "../../../../../domain/analytics/types.ts";
import { formatDate } from "../../../../utils/format.ts";
import { formatBudgetMinor } from "../../BudgetsPage.helpers.ts";
import styles from "./BudgetConsumptionDialog.module.css";

const PAGE_SIZE = 25;
const STATUS_LABELS: Readonly<Record<TransactionStatus, string>> = {
  CLEARED: "Compensada",
  RECONCILED: "Conciliada",
  UNRECONCILED: "Sin conciliar",
  VOID: "Anulada",
};

interface BudgetConsumptionDialogProps {
  readonly title: string;
  readonly contributions: readonly BudgetContribution[];
  readonly currency: string;
  readonly fractionDigits: number;
  readonly dateBasis: "operation" | "value";
  readonly trigger: HTMLButtonElement;
  readonly onDismiss: () => void;
}

export function BudgetConsumptionDialog({
  title,
  contributions,
  currency,
  fractionDigits,
  dateBasis,
  trigger,
  onDismiss,
}: BudgetConsumptionDialogProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const newlyRevealedRef = useRef<HTMLLIElement>(null);
  const [newItemsStart, setNewItemsStart] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const totalMinor = contributions.reduce((sum, entry) => sum + entry.amountMinor, 0);

  useLayoutEffect(() => {
    if (newItemsStart !== null && visibleCount >= contributions.length) {
      newlyRevealedRef.current?.focus();
    }
  }, [visibleCount, contributions.length, newItemsStart]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
    return () => {
      if (dialog?.open) dialog.close();
      if (trigger.isConnected) trigger.focus();
    };
  }, [trigger]);

  return (
    <dialog
      aria-labelledby={headingId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClose={() => {
        if (!dialogRef.current?.open) onDismiss();
      }}
      ref={dialogRef}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Consumo del presupuesto</p>
          <h2 id={headingId}>{title} · apuntes</h2>
          <p>{contributions.length} {contributions.length === 1 ? "apunte" : "apuntes"} · {formatBudgetMinor(totalMinor, currency, fractionDigits)}</p>
        </div>
        <button className={styles.closeButton} onClick={onDismiss} ref={closeRef} type="button">
          Cerrar detalle
        </button>
      </header>
      <section aria-labelledby={headingId} className={styles.body} tabIndex={0}>
        <p className={styles.note}>
          Importe con signo en {currency}: los reintegros reducen el consumo. El detalle conserva el filtro global y el filtro propio del presupuesto.
        </p>
        {contributions.length === 0 ? (
          <p>No hay apuntes para este consumo.</p>
        ) : (
          <ol className={styles.list}>
            {contributions.slice(0, visibleCount).map(({ posting, amountMinor }, index) => (
              <li
                className={styles.row}
                key={posting.id}
                ref={index === newItemsStart ? newlyRevealedRef : undefined}
                tabIndex={index === newItemsStart ? -1 : undefined}
              >
                <div className={styles.rowMain}>
                  <strong>{posting.payee || posting.comment || "Apunte sin concepto"}</strong>
                  <span>{formatDate(dateBasis === "value" ? posting.valueDate ?? posting.date : posting.date)} · {posting.accountLabel}</span>
                  <span>{posting.categoryPath.join(" › ") || "Sin categoría"} · {STATUS_LABELS[posting.status]}</span>
                  <span className={styles.identifier}>ID: {posting.id}</span>
                </div>
                <div className={styles.amounts}>
                  <strong>{formatBudgetMinor(amountMinor, currency, fractionDigits)}</strong>
                  {posting.currency !== currency ? (
                    <span>Original: {formatBudgetMinor(posting.amountNativeMinor, posting.currency, posting.fractionDigits)}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
        {visibleCount < contributions.length ? (
          <button
            className={styles.moreButton}
            onClick={() => {
              setNewItemsStart(visibleCount);
              setVisibleCount((count) => count + PAGE_SIZE);
            }}
            type="button"
          >
            Mostrar más · {Math.min(visibleCount, contributions.length)} de {contributions.length}
          </button>
        ) : null}
      </section>
    </dialog>
  );
}
