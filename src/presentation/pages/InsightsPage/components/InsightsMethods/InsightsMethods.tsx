import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { identityOptionLabel } from "../../../../components/organisms/FilterDrawer/FilterDrawer.helpers.ts";
import { countFormatter, formatEuroMinor } from "../../../../utils/format.ts";
import styles from "./InsightsMethods.module.css";
import type { InsightsMethodsProps } from "./InsightsMethods.types.ts";

export function InsightsMethods({ methods, onViewMethod, searchPending = false }: InsightsMethodsProps) {
  if (methods.usedPostingCount === 0) return null;

  const labelCounts = new Map<string, number>();
  for (const method of methods.methods) {
    const label = method.name.trim().toLocaleLowerCase("es");
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const displayLabel = (method: (typeof methods.methods)[number]) => identityOptionLabel(
    method.identityKey,
    method.name,
    "method",
    (labelCounts.get(method.name.trim().toLocaleLowerCase("es")) ?? 0) > 1,
  );

  return (
    <Panel
      actions={<Badge tone="neutral">Métodos usados: {countFormatter.format(methods.usedMethodCount)} · Definidos: {countFormatter.format(methods.definedMethodCount)}</Badge>}
      className={styles.panel}
      description="Ranking por número de movimientos computados en el filtro actual; los empates se ordenan por nombre. El importe es el neto con signo, no el criterio de orden."
      footer={`Apuntes activos con método: ${countFormatter.format(methods.usedPostingCount)} de ${countFormatter.format(methods.activePostingCount)}`}
      title="Métodos de pago"
    >
      <div className={styles.columnLabels} aria-hidden="true">
        <span>Método · movimientos computados</span>
        <span>Neto con signo</span>
      </div>
      <ol className={styles.list}>
        {methods.methods.map((method, index) => (
          <li className={styles.item} key={method.identityKey}>
            <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.identity}>
              <strong>{displayLabel(method)}</strong>
              <small>{countFormatter.format(method.postingCount)} {method.postingCount === 1 ? "movimiento computado" : "movimientos computados"}</small>
            </span>
            <strong className={styles.amount}>{formatEuroMinor(method.netEurMinor)}</strong>
            {onViewMethod === undefined ? null : (
              <button
                className={styles.drilldown}
                disabled={searchPending}
                onClick={() => onViewMethod(method.identityKey)}
                type="button"
              >
                Ver {countFormatter.format(method.postingCount)} {method.postingCount === 1 ? "movimiento computado" : "movimientos computados"} de {displayLabel(method)}
              </button>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
