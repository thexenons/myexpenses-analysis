import type { BudgetAllocationNode } from "../../../../../domain/analytics/budgets.ts";
import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import type { Tone } from "../../../../components/atoms/Badge/Badge.types.ts";
import type { DataTableColumn } from "../../../../components/organisms/DataTable/DataTable.types.ts";
import { formatBudgetMinor } from "../../BudgetsPage.helpers.ts";
import { BudgetUtilization } from "../BudgetUtilization/BudgetUtilization.tsx";
import styles from "./BudgetAllocationTable.module.css";

const SOURCE_LABELS = {
  EXACT: "Periodo",
  FALLBACK: "Heredada",
  NONE: "Sin base",
  ROLLUP: "Roll-up",
} as const;

const HEALTH_TONES: Readonly<Record<BudgetAllocationNode["health"], Tone>> = {
  "on-track": "positive",
  watch: "warning",
  exceeded: "negative",
  unallocated: "neutral",
};

export function createBudgetAllocationColumns(
  currency: string,
  fractionDigits: number,
): readonly DataTableColumn<BudgetAllocationNode>[] {
  return [
    {
      key: "category",
      header: "Categoría",
      rowHeader: true,
      cell: (row) => (
        <div
          className={styles.category}
          data-depth={Math.min(row.depth, 8)}
        >
          <span className={styles.categoryName}>{row.name}</span>
          <span className={styles.path}>{row.path.join(" › ")}</span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Origen",
      cell: (row) => (
        <span className={styles.badges}>
          <Badge tone={row.allocationSource === "FALLBACK" ? "warning" : "info"}>
            {SOURCE_LABELS[row.allocationSource]}
          </Badge>
          {row.oneTime ? <Badge tone="accent">Única</Badge> : null}
        </span>
      ),
    },
    {
      key: "assigned",
      header: "Asignado",
      align: "end",
      cell: (row) =>
        formatBudgetMinor(row.assignedMinor, currency, fractionDigits),
    },
    {
      key: "rollover",
      header: "Arrastre",
      align: "end",
      cell: (row) => (
        <span className={styles.rollover}>
          <span>
            {formatBudgetMinor(
              row.rolloverPreviousMinor,
              currency,
              fractionDigits,
            )}
          </span>
          {row.rolloverNextMinor === 0 ? null : (
            <span className={styles.nextRollover}>
              sig. {formatBudgetMinor(row.rolloverNextMinor, currency, fractionDigits)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "consumed",
      header: "Consumido",
      align: "end",
      cell: (row) =>
        formatBudgetMinor(row.consumedMinor, currency, fractionDigits),
    },
    {
      key: "available",
      header: "Disponible",
      align: "end",
      cell: (row) => (
        <strong className={styles[`${row.health}Amount`]}>
          {formatBudgetMinor(row.availableMinor, currency, fractionDigits)}
        </strong>
      ),
    },
    {
      key: "utilization",
      header: "Utilización",
      cell: (row) => (
        <BudgetUtilization
          health={row.health}
          label={`Utilización de ${row.path.join(" › ")}`}
          utilization={row.utilization}
        />
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      cell: (row) => (
        <Badge tone={HEALTH_TONES[row.health]}>
          {row.health === "on-track"
            ? "En margen"
            : row.health === "watch"
              ? "Vigilancia"
              : row.health === "exceeded"
                ? "Excedido"
                : "Sin asignar"}
        </Badge>
      ),
    },
  ];
}
