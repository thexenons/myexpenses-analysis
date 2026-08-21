import type { NormalizedPosting } from "../../../domain/analytics/types.ts";
import type { TransactionSortKey } from "./TransactionsPage.types.ts";

export const TRANSACTIONS_PAGE_SIZE = 50;

function csvCell(value: string | number): string {
  const raw = String(value);
  const source =
    typeof value === "string" && /^\s*[=+\-@]/.test(value)
      ? `'${value}`
      : raw;
  return /[",\r\n]/.test(source)
    ? `"${source.replaceAll('"', '""')}"`
    : source;
}

export function createPostingsCsv(
  postings: readonly NormalizedPosting[],
): string {
  const header = [
    "fecha",
    "cuenta",
    "tipo_cuenta",
    "categoria",
    "payee",
    "comentario",
    "estado",
    "enlazada",
    "importe_eur",
    "uuid_hoja",
    "uuid_padre",
    "split_indice",
    "split_total",
    "fecha_padre",
    "importe_padre_original",
    "payee_padre",
    "comentario_padre",
    "etiquetas_padre",
    "cuenta_uuid",
    "moneda_original",
    "importe_original",
    "tipo_categoria",
    "bucket",
    "tasa_eur",
    "fuente_tasa",
    "cuenta_vinculada",
    "etiquetas",
  ];
  const lines = postings.map((posting) =>
    [
      posting.date,
      posting.accountLabel,
      posting.accountType,
      posting.categoryPath.join(" > "),
      posting.payee ?? "",
      posting.comment ?? "",
      posting.status,
      posting.linked ? "sí" : "no",
      posting.amountEurMinor / 100,
      posting.transactionId,
      posting.splitIndex === null ? "" : posting.sourceTransactionId,
      posting.splitIndex ?? "",
      posting.splitCount ?? "",
      posting.parent?.date ?? "",
      posting.parent?.amount ?? "",
      posting.parent?.payee ?? "",
      posting.parent?.comment ?? "",
      posting.parent?.tags?.join(" | ") ?? "",
      posting.accountId,
      posting.currency,
      posting.amountNativeMinor / 100,
      posting.categoryType,
      posting.bucket,
      posting.exchangeRateToEur,
      posting.exchangeRateSource,
      posting.transferAccount ?? "",
      posting.tags.join(" | "),
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export function downloadPostingsCsv(
  postings: readonly NormalizedPosting[],
): void {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", createPostingsCsv(postings)], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "movimientos-filtrados.csv";
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function sortPostings(
  postings: readonly NormalizedPosting[],
  sortKey: TransactionSortKey,
  descending: boolean,
): readonly NormalizedPosting[] {
  return postings.toSorted((left, right) => {
    const comparison =
      sortKey === "date"
        ? left.date.localeCompare(right.date)
        : left.amountEurMinor - right.amountEurMinor;
    return descending ? -comparison : comparison;
  });
}
