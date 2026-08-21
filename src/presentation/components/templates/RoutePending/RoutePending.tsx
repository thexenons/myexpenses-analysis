import styles from "./RoutePending.module.css";

export function RoutePending() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={styles.root}
      role="status"
    >
      <span aria-hidden="true" className={styles.indicator} />
      <span>Cargando sección…</span>
    </div>
  );
}
