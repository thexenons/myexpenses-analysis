import type { ReactNode } from "react";

import styles from "./InformationDisclosure.module.css";

interface InformationDisclosureProps {
  readonly children: ReactNode;
  readonly label: string;
}

export function InformationDisclosure({ children, label }: InformationDisclosureProps) {
  return (
    <details className={styles.root}>
      <summary className={styles.summary}>{label}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
