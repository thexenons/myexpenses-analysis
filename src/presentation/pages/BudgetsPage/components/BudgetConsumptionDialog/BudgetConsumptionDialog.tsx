/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The named overflow region needs a durable Tab entry after the final batch removes its button. */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { BudgetContribution } from "../../../../../domain/analytics/budgets.ts";
import { resolvePostingAccounts } from "../../../../../domain/analytics/transfer-relations.ts";
import type { AnalyticsDataset } from "../../../../../domain/analytics/types.ts";
import { formatDate } from "../../../../utils/format.ts";
import { formatBudgetMinor } from "../../BudgetsPage.helpers.ts";
import styles from "./BudgetConsumptionDialog.module.css";

const PAGE_SIZE = 25;

interface BudgetConsumptionDialogProps {
  readonly title: string;
  readonly contributions: readonly BudgetContribution[];
  readonly currency: string;
  readonly dataset: AnalyticsDataset;
  readonly fractionDigits: number;
  readonly dateBasis: "operation" | "value";
  readonly trigger: HTMLButtonElement;
  readonly onDismiss: () => void;
}

export function BudgetConsumptionDialog({
  title,
  contributions: rawContributions,
  currency,
  dataset,
  fractionDigits,
  dateBasis,
  trigger,
  onDismiss,
}: BudgetConsumptionDialogProps) {
  const contributions = useMemo(() => rawContributions.filter(({ posting }) => !posting.isVoid), [rawContributions]);
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
            {contributions.slice(0, visibleCount).map(({ posting, amountMinor }, index) => {
              const showTransfer = posting.categoryType === "TRANSFER" || posting.linked || posting.transferPeerPostingId !== undefined;
              const transfer = showTransfer ? resolvePostingAccounts(posting, dataset) : null;
              return (
              <li
                className={styles.row}
                key={posting.id}
                ref={index === newItemsStart ? newlyRevealedRef : undefined}
                tabIndex={index === newItemsStart ? -1 : undefined}
              >
                <div className={styles.rowHeading}>
                  <strong className={styles.payee}>{posting.payee?.trim() || "Sin beneficiario"}</strong>
                  <data className={styles.amount} value={amountMinor / 10 ** fractionDigits}>{formatBudgetMinor(amountMinor, currency, fractionDigits)}</data>
                </div>
                <dl className={styles.primaryFacts}>
                  <div><dt>Fecha</dt><dd>{formatDate(dateBasis === "value" ? posting.valueDate ?? posting.date : posting.date)}</dd></div>
                  <div><dt>Cuenta</dt><dd>{posting.accountLabel}</dd></div>
                  <div><dt>Categoría</dt><dd>{posting.categoryPath.join(" › ") || "Sin categoría"}</dd></div>
                  <div className={styles.wideFact}><dt>Comentario</dt><dd>{posting.comment?.trim() || "Sin comentario"}</dd></div>
                  {transfer === null ? null : <>
                    <div><dt>Origen</dt><dd>{transfer.originAccount?.label ?? "No verificada"}</dd></div>
                    <div><dt>Destino</dt><dd>{transfer.destinationAccount?.label ?? "No verificada"}</dd></div>
                  </>}
                </dl>
                <details className={styles.technicalDetails}>
                  <summary>Datos técnicos</summary>
                  <dl className={styles.technicalFacts}>
                    <div><dt>Importe en cuenta</dt><dd>{formatBudgetMinor(posting.amountNativeMinor, posting.currency, posting.fractionDigits)}</dd></div>
                    <div><dt>ID</dt><dd className={styles.identifier}>ID: {posting.id}</dd></div>
                    {posting.sourceRowId === undefined ? null : <div><dt>Fila SQLite</dt><dd>{posting.sourceRowId}</dd></div>}
                    {posting.referenceNumber ? <div><dt>Referencia</dt><dd>{posting.referenceNumber}</dd></div> : null}
                    {posting.paymentMethod ? <div><dt>Método de pago</dt><dd>{posting.paymentMethod}</dd></div> : null}
                    {posting.tags.length > 0 ? <div><dt>Etiquetas</dt><dd>{posting.tags.join(" · ")}</dd></div> : null}
                    {posting.originalAmountMinor !== undefined && posting.originalCurrency !== undefined ? <div><dt>Importe importado</dt><dd>{formatBudgetMinor(posting.originalAmountMinor, posting.originalCurrency, posting.originalFractionDigits ?? 2)}</dd></div> : null}
                    {posting.splitCount === null ? null : <div><dt>Parte de split</dt><dd>{(posting.splitIndex ?? 0) + 1} de {posting.splitCount}</dd></div>}
                    {posting.splitParentSourceId === undefined ? null : <div><dt>ID del padre</dt><dd>{posting.splitParentSourceId}</dd></div>}
                    {posting.sourceTransactionId === posting.transactionId ? null : <div><dt>UUID padre</dt><dd>{posting.sourceTransactionId}</dd></div>}
                    {posting.parent === undefined ? null : <>
                      <div><dt>Fecha del padre</dt><dd>{formatDate(posting.parent.date)}</dd></div>
                      {posting.parent.payee ? <div><dt>Payee del padre</dt><dd>{posting.parent.payee}</dd></div> : null}
                      {posting.parent.comment ? <div><dt>Comentario padre</dt><dd>{posting.parent.comment}</dd></div> : null}
                      {posting.parent.paymentMethod ? <div><dt>Método del padre</dt><dd>{posting.parent.paymentMethod}</dd></div> : null}
                      {(posting.parent.tags?.length ?? 0) > 0 ? <div><dt>Etiquetas del padre</dt><dd>{posting.parent.tags?.join(" · ")}</dd></div> : null}
                    </>}
                  </dl>
                </details>
              </li>
              );
            })}
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
