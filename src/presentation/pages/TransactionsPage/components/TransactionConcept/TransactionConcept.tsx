import styles from "./TransactionConcept.module.css";
import type { TransactionConceptProps } from "./TransactionConcept.types.ts";
import { TransactionDetails } from "../TransactionDetails/index.ts";

export function TransactionConcept({ posting }: TransactionConceptProps) {
  return (
    <div className={styles.main}>
      <span className={styles.title}>
        {posting.payee ?? posting.comment ?? posting.categoryPath.at(-1)}
      </span>
      <span className={styles.note}>
        {[posting.comment, posting.tags.join(" · ")].filter(Boolean).join(" · ") ||
          posting.transactionId}
      </span>
      <TransactionDetails posting={posting} />
    </div>
  );
}
