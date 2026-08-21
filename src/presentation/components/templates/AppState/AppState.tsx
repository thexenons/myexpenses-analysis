import { Button } from "../../atoms/Button/index.ts";
import styles from "./AppState.module.css";
import type { AppStateProps } from "./AppState.types.ts";

export function AppState(props: AppStateProps) {
  const loading = props.state === "loading";

  return (
    <main
      aria-busy={loading ? "true" : undefined}
      className={styles.root}
    >
      <div
        aria-atomic="true"
        aria-live={loading ? "polite" : "assertive"}
        className={styles.content}
        role={loading ? "status" : "alert"}
      >
        <span aria-hidden="true" className={styles.mark} />
        <h1 className={styles.title}>
          {loading ? "Ordenando el libro mayor" : "No pudimos abrir los datos"}
        </h1>
        <p className={styles.description}>
          {loading
            ? "Indexando cuentas, categorías y movimientos…"
            : props.message}
        </p>
        {loading ? (
          <span aria-hidden="true" className={styles.skeleton} />
        ) : (
          <Button onClick={props.onRetry} variant="primary">
            Volver a intentarlo
          </Button>
        )}
      </div>
    </main>
  );
}
