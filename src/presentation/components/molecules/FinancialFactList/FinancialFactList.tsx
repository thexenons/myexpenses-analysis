import type { ReactNode } from "react";

import styles from "./FinancialFactList.module.css";

export interface FinancialFact {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
}

export function FinancialFactList({ items }: { readonly items: readonly FinancialFact[] }) {
  return (
    <dl className={styles.list}>
      {items.map(({ id, label, value }) => (
        <div className={styles.row} key={id}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
