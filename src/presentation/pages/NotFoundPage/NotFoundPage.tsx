import { Link } from "@tanstack/react-router";

import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className={styles.root}>
      <title>Página no encontrada · My Expenses</title>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Error 404</p>
        <h1 className={styles.title} id="not-found-title">
          Esta página no existe
        </h1>
        <p className={styles.description}>
          La dirección no corresponde a ninguna sección del cuaderno financiero.
        </p>
        <Link className={styles.link} to="/resumen">
          Volver al resumen
        </Link>
      </div>
    </section>
  );
}
