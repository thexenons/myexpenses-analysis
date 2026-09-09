import { useState } from "react";

import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { ChartDataTable } from "../../../../components/organisms/ChartDataTable/ChartDataTable.tsx";
import { countFormatter, euroFormatter, formatEuroMinor } from "../../../../utils/format.ts";
import styles from "./InsightsPayees.module.css";
import type { InsightsPayeesProps } from "./InsightsPayees.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function InsightsPayees({ payees }: InsightsPayeesProps) {
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
  const allPayees = new Map(
    groups.flatMap((group) => group.rows.map((item) => [item.sourceId === null ? `name:${item.name}` : `id:${item.sourceId}`, item] as const)),
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
            {countFormatter.format(payees.activePostingCount)} apuntes activos ·{" "}
            {countFormatter.format(payees.usedPayeeCount)} payees usados de{" "}
            {countFormatter.format(payees.definedPayeeCount)} definidos
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
                  <li className={styles.rankItem} key={item.sourceId === null ? `name:${item.name}` : `id:${item.sourceId}`}>
                    <span className={styles.rankIndex} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.rankIdentity}>
                      <strong>{item.name}</strong>
                      <small>
                        {countFormatter.format(item.postingCount)} apuntes
                      </small>
                    </span>
                    <strong className={styles.rankAmount}>
                      {formatEuroMinor(group.amount(item))}
                    </strong>
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
        rows={() => [...allPayees].map(([id, item]) => ({ id, label: item.name, values: [-item.expenseEurMinor / 100 || 0, item.incomeEurMinor / 100, item.netEurMinor / 100] }))}
      />
    </Panel>
  );
}
