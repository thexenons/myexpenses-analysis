import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { countFormatter, formatEuroMinor } from "../../../../utils/format.ts";
import styles from "./InsightsPayees.module.css";
import type { InsightsPayeesProps } from "./InsightsPayees.types.ts";

const percentageFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  style: "percent",
});

export function InsightsPayees({ payees }: InsightsPayeesProps) {
  const groups = [
    {
      amount: (item: (typeof payees.topExpenses)[number]) =>
        Math.abs(item.expenseEurMinor),
      id: "expense",
      label: "Gasto clasificado",
      rows: payees.topExpenses,
      tone: "expense",
    },
    {
      amount: (item: (typeof payees.topIncome)[number]) =>
        Math.abs(item.incomeEurMinor),
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

  return (
    <Panel
      className={styles.deferredPanel}
      description="Ranking descriptivo dentro del filtro actual. El neto conserva el signo y no implica recurrencia ni causalidad."
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
                {group.rows.map((item, index) => (
                  <li className={styles.rankItem} key={item.name}>
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
    </Panel>
  );
}
