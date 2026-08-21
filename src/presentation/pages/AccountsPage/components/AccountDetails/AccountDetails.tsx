import {
  countFormatter,
  formatCurrencyMinor,
  formatEuroMinor,
} from "../../../../utils/format.ts";
import {
  exchangeModeLabel,
  formatAccountExchangeRate,
} from "./AccountDetails.helpers.ts";
import styles from "./AccountDetails.module.css";
import type { AccountDetailsProps } from "./AccountDetails.types.ts";

export function AccountDetails({
  exchangeRateToEur,
  item,
}: AccountDetailsProps) {
  const { account } = item;

  return (
    <details className={styles.root}>
      <summary className={styles.summary}>
        Detalles de {account.label}
      </summary>
      <dl className={styles.content}>
        <div className={styles.item}>
          <dt className={styles.term}>Apertura del periodo</dt>
          <dd className={styles.description}>
            {formatEuroMinor(item.periodOpeningBalanceEurMinor)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Apertura nativa</dt>
          <dd className={styles.description}>
            {formatCurrencyMinor(
              account.openingBalanceNativeMinor,
              account.currency,
            )}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Saldo nativo actual</dt>
          <dd className={styles.description}>
            {formatCurrencyMinor(
              account.currentBalanceNativeMinor,
              account.currency,
            )}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Saldo histórico EUR</dt>
          <dd className={styles.description}>
            {formatEuroMinor(account.historicalBalanceEurMinor)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Valoración actual EUR</dt>
          <dd className={styles.description}>
            {formatEuroMinor(account.valuationBalanceEurMinor)}
          </dd>
        </div>
        <div className={styles.item}>
          <dt className={styles.term}>Modo de conversión</dt>
          <dd className={styles.description}>
            {exchangeModeLabel(account.exchangeRateMode)}
          </dd>
        </div>
        <div className={`${styles.item} ${styles.wide}`}>
          <dt className={styles.term}>Tasa a EUR</dt>
          <dd className={styles.description}>
            {formatAccountExchangeRate(account.currency, exchangeRateToEur)}
          </dd>
        </div>
        <div className={`${styles.item} ${styles.wide}`}>
          <dt className={styles.term}>Apuntes activos / totales</dt>
          <dd className={styles.description}>
            {countFormatter.format(account.activePostingCount)} /{" "}
            {countFormatter.format(account.postingCount)}
          </dd>
        </div>
      </dl>
    </details>
  );
}
