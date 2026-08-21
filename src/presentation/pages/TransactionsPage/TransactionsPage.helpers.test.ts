import { describe, expect, it } from "vitest";

import { createPostingsCsv } from "./TransactionsPage.helpers.ts";
import { TRANSACTION_POSTING_FIXTURE } from "./TransactionsPage.test.helpers.ts";

describe("createPostingsCsv", () => {
  it("exports audit fields and neutralizes formulas without changing numbers", () => {
    const csv = createPostingsCsv([
      {
        ...TRANSACTION_POSTING_FIXTURE,
        accountId: "account-uuid",
        accountLabel: "=ACCOUNT",
        amountEurMinor: -1_150,
        amountNativeMinor: -1_250,
        categoryPath: ["+CATEGORY"],
        comment: "@COMMENT",
        currency: "USD",
        exchangeRateSource: "static",
        exchangeRateToEur: 0.92,
        linked: true,
        parent: {
          amount: -25,
          comment: "+PARENT COMMENT",
          date: "2026-08-19",
          payee: "=PARENT PAYEE",
          tags: ["@PARENT TAG"],
        },
        payee: "-PAYEE",
        sourceTransactionId: "parent-uuid",
        splitCount: 2,
        splitIndex: 0,
        tags: ["audit"],
        transactionId: "leaf-uuid",
        transferAccount: "Cuenta destino",
      },
    ]);
    const [header, row] = csv.split("\n").map((line) => line.split(","));

    expect(header).toEqual([
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
    ]);
    expect(row).toEqual([
      "2026-08-20",
      "'=ACCOUNT",
      "DEFAULT",
      "'+CATEGORY",
      "'-PAYEE",
      "'@COMMENT",
      "RECONCILED",
      "sí",
      "-11.5",
      "leaf-uuid",
      "parent-uuid",
      "0",
      "2",
      "2026-08-19",
      "-25",
      "'=PARENT PAYEE",
      "'+PARENT COMMENT",
      "'@PARENT TAG",
      "account-uuid",
      "USD",
      "-12.5",
      "EXPENSE",
      "expense",
      "0.92",
      "static",
      "Cuenta destino",
      "audit",
    ]);
    expect(row?.[8]?.startsWith("'")).toBe(false);
    expect(row?.[11]?.startsWith("'")).toBe(false);
    expect(row?.[12]?.startsWith("'")).toBe(false);
    expect(row?.[14]?.startsWith("'")).toBe(false);
    expect(row?.[20]?.startsWith("'")).toBe(false);
    expect(row?.[23]?.startsWith("'")).toBe(false);
  });

  it("quotes carriage returns in text fields", () => {
    const csv = createPostingsCsv([
      {
        ...TRANSACTION_POSTING_FIXTURE,
        comment: "línea uno\rlínea dos",
      },
    ]);

    expect(csv).toContain('"línea uno\rlínea dos"');
  });
});
