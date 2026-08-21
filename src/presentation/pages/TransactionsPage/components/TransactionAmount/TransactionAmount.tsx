import { amountTone, formatEuroMinor } from "../../../../utils/format.ts";
import styles from "./TransactionAmount.module.css";
import type { TransactionAmountProps } from "./TransactionAmount.types.ts";

export function TransactionAmount({ posting }: TransactionAmountProps) {
  const tone = amountTone(posting.amountEurMinor);

  return (
    <strong className={`${styles.numeric} ${styles[tone]}`}>
      {formatEuroMinor(posting.amountEurMinor)}
    </strong>
  );
}
