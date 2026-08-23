import styles from "./RoutePending.module.css";

export function RoutePending() {
  return (
    <output
      aria-busy="true"
      aria-live="polite"
      className={styles.root}
    >
      <span aria-hidden="true" className={styles.indicator} />
      <span>Cargando sección…</span>
    </output>
  );
}
