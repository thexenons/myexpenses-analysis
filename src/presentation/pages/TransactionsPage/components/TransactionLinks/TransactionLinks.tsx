import { useMemo, useState } from "react";

import { resolvePostingAccounts } from "../../../../../domain/analytics/transfer-relations.ts";
import { formatDate, formatEuroMinor } from "../../../../utils/format.ts";
import { reconciliationStatusLabel } from "../TransactionDetails/TransactionDetails.helpers.ts";
import { relatedTransactionPostings } from "./TransactionLinks.helpers.ts";
import styles from "./TransactionLinks.module.css";
import type { TransactionLinksProps } from "./TransactionLinks.types.ts";

export function TransactionLinks({ dataset, posting }: TransactionLinksProps) {
  const [open, setOpen] = useState(false);
  const peer = resolvePostingAccounts(posting, dataset).peer;
  const related = useMemo(() => open ? relatedTransactionPostings(posting, dataset) : [], [dataset, open, posting]);
  if (peer === undefined && posting.splitIndex === null) return null;
  return (
    <details className={styles.root} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Ver operación y contrapartida</summary>
      {open ? <div className={styles.content}>
        <p>Contexto del archivo completo: puede incluir movimientos fuera de los filtros. Cada importe corresponde a un apunte; las contrapartidas no se suman como compras adicionales.</p>
        {related.length === 0 ? <p>No hay otros apuntes disponibles de esta operación.</p> : <ul>
          {related.map((row) => <li key={row.id}>
            <strong>{row.accountLabel} · {formatEuroMinor(row.amountEurMinor)}</strong>
            <span>{formatDate(row.date)} · {row.categoryPath.join(" › ")} · {reconciliationStatusLabel(row)}</span>
            <span>{row.id === peer?.id ? "Contrapartida" : "Parte de la misma operación"} · {row.id}</span>
          </li>)}
        </ul>}
      </div> : null}
    </details>
  );
}
