import type { AnnualProjectionResult } from "../../../../../domain/analytics/annual-projection.ts";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { AnnualProjectionContent } from "./AnnualProjection.Content.tsx";
import styles from "./AnnualProjection.module.css";

const unavailableLabels: Record<Extract<AnnualProjectionResult, { status: "unavailable" }>["reason"], string> = {
  "unsupported-grouping": "Solo se pueden proyectar presupuestos mensuales o anuales.",
  "incompatible-currency": "La moneda del presupuesto no se puede comparar de forma segura con el flujo real en euros.",
  "filtered-scope": "Los filtros de contenido recortan el historial. Restablécelos para consultar el año completo.",
  "invalid-period": "El periodo seleccionado no identifica un año válido para la proyección.",
  "no-complete-months": "No hay ningún mes completo y cubierto de este año para estimar ingresos. No se inventa una media.",
};

export function AnnualProjection({
  result,
  error,
}: {
  readonly result: AnnualProjectionResult | null;
  readonly error: "calculation-error" | null;
}) {
  return (
    <Panel className={styles.panel} title="Proyección anual de ahorro" description="Flujo neto acumulado a fin de cada mes, no saldo de la cuenta.">
      {error !== null ? (
        <p className={styles.unavailable}>No se ha podido calcular la proyección con seguridad.</p>
      ) : result?.status === "unavailable" ? (
        <p className={styles.unavailable}>{unavailableLabels[result.reason]}</p>
      ) : result?.status === "ready" ? (
        <AnnualProjectionContent result={result} />
      ) : null}
    </Panel>
  );
}
