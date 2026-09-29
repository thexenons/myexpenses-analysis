import { useState } from "react";

import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { ChartDataTable } from "../../../../components/organisms/ChartDataTable/ChartDataTable.tsx";
import { identityOptionLabel } from "../../../../components/organisms/FilterDrawer/FilterDrawer.helpers.ts";
import { countFormatter, euroFormatter, formatCount, formatEuroMinor } from "../../../../utils/format.ts";
import styles from "./InsightsPayees.module.css";
import type { InsightsPayeesProps } from "./InsightsPayees.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function InsightsPayees({ onViewPayee, payees, searchPending = false }: InsightsPayeesProps) {
  const [limit, setLimit] = useState("5");
  const groups = [
    {
      amount: (item: (typeof payees.topExpenses)[number]) =>
        -item.expenseEurMinor || 0,
      id: "expense",
      label: "Gasto clasificado",
      rows: payees.topExpenses,
      tone: "expense",
    },
    {
      amount: (item: (typeof payees.topIncome)[number]) =>
        item.incomeEurMinor,
      id: "income",
      label: "Ingreso clasificado",
      rows: payees.topIncome,
      tone: "income",
    },
    {
      amount: (item: (typeof payees.topNet)[number]) => item.netEurMinor,
      id: "net",
      label: "Neto absoluto",
      rows: payees.topNet,
      tone: "net",
    },
  ] as const;
  const allPayees = new Map(groups.flatMap((group) => group.rows.map((item) => [item.identityKey, item] as const)));
  const labelCounts = new Map<string, number>();
  for (const item of allPayees.values()) {
    const label = item.name.trim().toLocaleLowerCase("es");
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const displayLabel = (item: (typeof payees.topExpenses)[number]) => identityOptionLabel(
    item.identityKey, item.name, "payee", (labelCounts.get(item.name.trim().toLocaleLowerCase("es")) ?? 0) > 1,
  );

  return (
    <Panel
      actions={
        <label className={styles.limitControl}>
          <span>Contrapartes por ranking</span>
          <select onChange={(event) => setLimit(event.currentTarget.value)} value={limit}>
            <option value="5">5</option>
            <option value="12">12</option>
            <option value="25">25</option>
            <option value="all">Todas</option>
          </select>
        </label>
      }
      className={styles.deferredPanel}
      description="Ranking por valor absoluto dentro del filtro actual. El gasto negativo indica una devolución neta; los ingresos y el neto conservan su signo. La tabla y el CSV incluyen todas las contrapartes con importes, aunque limites el ranking."
      footer={
        <div className={styles.coverageFooter}>
          <Badge tone="accent">
            {percentageFormatter.format(payees.coverageRatio)} con payee
          </Badge>
          <span>
            {countFormatter.format(payees.payeePostingCount)} de{" "}
            {formatCount(payees.activePostingCount, "apunte activo", "apuntes activos")} ·{" "}
            {formatCount(payees.usedPayeeCount, "payee usado", "payees usados")} de{" "}
            {formatCount(payees.definedPayeeCount, "definido", "definidos")}
          </span>
        </div>
      }
      title="Contrapartes con más actividad"
    >
      <div className={styles.rankGrid}>
        {groups.map((group) => (
          <section
            aria-labelledby={`payee-rank-${group.id}`}
            className={styles.rankGroup}
            data-tone={group.tone}
            key={group.id}
          >
            <h3 className={styles.rankTitle} id={`payee-rank-${group.id}`}>
              {group.label}
            </h3>
            {group.rows.length === 0 ? (
              <p className={styles.emptyCopy}>Sin payees en este corte.</p>
            ) : (
              <ol className={styles.rankList}>
                {(limit === "all" ? group.rows : group.rows.slice(0, Number(limit))).map((item, index) => (
                  <li className={styles.rankItem} key={item.identityKey}>
                    <span className={styles.rankIndex} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.rankIdentity}>
                      <strong title={displayLabel(item)}>{displayLabel(item)}</strong>
                      <small>
                        {countFormatter.format(item.postingCount)} {item.postingCount === 1 ? "movimiento computado" : "movimientos computados"}
                      </small>
                    </span>
                    <strong className={styles.rankAmount}>
                      {formatEuroMinor(group.amount(item))}
                    </strong>
                    {onViewPayee === undefined ? null : (
                      <button
                        className={styles.drilldown}
                        disabled={searchPending}
                        onClick={() => onViewPayee(item.identityKey)}
                        type="button"
                      >
                        Ver {countFormatter.format(item.postingCount)} {item.postingCount === 1 ? "movimiento computado" : "movimientos computados"} de {displayLabel(item)}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
      <ChartDataTable
        caption="Importes completos por contraparte"
        columns={[
          { id: "expenses", label: "Gasto neto (EUR)" },
          { id: "income", label: "Ingreso neto (EUR)" },
          { id: "net", label: "Neto (EUR)" },
        ]}
        formatValue={euroFormatter}
        labelHeader="Contraparte"
        rows={() => [...allPayees].map(([id, item]) => ({ id, label: displayLabel(item), values: [-item.expenseEurMinor / 100 || 0, item.incomeEurMinor / 100, item.netEurMinor / 100] }))}
      />
    </Panel>
  );
}
