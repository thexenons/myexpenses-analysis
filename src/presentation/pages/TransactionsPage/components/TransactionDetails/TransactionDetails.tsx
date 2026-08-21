import {
  formatCurrencyMinor,
  formatDate,
  formatEuroMinor,
} from "../../../../utils/format.ts";
import {
  bucketLabel,
  categoryTypeLabel,
  exchangeRateSourceLabel,
  formatExchangeRate,
  formatSplit,
  linkedAccountLabel,
  parentTransactionId,
} from "./TransactionDetails.helpers.ts";
import styles from "./TransactionDetails.module.css";
import type { TransactionDetailsProps } from "./TransactionDetails.types.ts";

export function TransactionDetails({ posting }: TransactionDetailsProps) {
  return (
    <details className={styles.root}>
      <summary className={styles.summary}>Ver trazabilidad</summary>
      <dl className={styles.content}>
        <div className={`${styles.item} ${styles.wide}`}>
          <dt className={styles.term}>UUID hoja</dt>
          <dd className={`${styles.description} ${styles.code}`}>
            {posting.transactionId}
          </dd>
        </div>
        <div className={`${styles.item} ${styles.wide}`}>
          <dt className={styles.term}>UUID padre</dt>
          <dd className={`${styles.description} ${styles.code}`}>
            {parentTransactionId(posting)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Split</dt>
          <dd className={styles.description}>{formatSplit(posting)}</dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Cuenta</dt>
          <dd className={styles.description}>
            {posting.accountLabel} · {posting.currency}
          </dd>
        </div>
        <div className={`${styles.item} ${styles.wide}`}>
          <dt className={styles.term}>UUID de cuenta</dt>
          <dd className={`${styles.description} ${styles.code}`}>
            {posting.accountId}
          </dd>
        </div>
        <div className={`${styles.item} ${styles.wide}`}>
          <dt className={styles.term}>Categoría</dt>
          <dd className={styles.description}>
            {posting.categoryPath.join(" › ")}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Tipo de categoría</dt>
          <dd className={styles.description}>
            {categoryTypeLabel(posting.categoryType)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Bucket analítico</dt>
          <dd className={styles.description}>{bucketLabel(posting.bucket)}</dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Importe original</dt>
          <dd className={styles.description}>
            {formatCurrencyMinor(posting.amountNativeMinor, posting.currency)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Equivalente EUR</dt>
          <dd className={styles.description}>
            {formatEuroMinor(posting.amountEurMinor)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Tasa aplicada</dt>
          <dd className={styles.description}>{formatExchangeRate(posting)}</dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Fuente de la tasa</dt>
          <dd className={styles.description}>
            {exchangeRateSourceLabel(posting.exchangeRateSource)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Vinculada</dt>
          <dd className={styles.description}>{linkedAccountLabel(posting)}</dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Etiquetas</dt>
          <dd className={styles.description}>
            {posting.tags.length > 0 ? posting.tags.join(" · ") : "Sin etiquetas"}
          </dd>
        </div>
        {posting.parent ? (
          <>
            <div className={styles.item}>
              <dt className={styles.term}>Fecha del padre</dt>
              <dd className={styles.description}>
                {formatDate(posting.parent.date)}
              </dd>
            </div>
            <div className={styles.item}>
              <dt className={styles.term}>Importe del padre</dt>
              <dd className={styles.description}>
                {formatCurrencyMinor(
                  Math.round(posting.parent.amount * 100),
                  posting.currency,
                )}
              </dd>
            </div>
            <div className={styles.item}>
              <dt className={styles.term}>Payee del padre</dt>
              <dd className={styles.description}>
                {posting.parent.payee ?? "Sin payee"}
              </dd>
            </div>
            <div className={`${styles.item} ${styles.wide}`}>
              <dt className={styles.term}>Comentario del padre</dt>
              <dd className={styles.description}>
                {posting.parent.comment ?? "Sin comentario"}
              </dd>
            </div>
            <div className={`${styles.item} ${styles.wide}`}>
              <dt className={styles.term}>Etiquetas del padre</dt>
              <dd className={styles.description}>
                {posting.parent.tags?.length
                  ? posting.parent.tags.join(" · ")
                  : "Sin etiquetas"}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </details>
  );
}
