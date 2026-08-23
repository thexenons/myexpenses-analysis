import { describe, expect, it } from "vitest";

import {
  createPostingsCsv,
  sortPostings,
} from "./TransactionsPage.helpers.ts";
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
        localTime: "18:30:00",
        paymentMethod: "Tarjeta",
        paymentMethodSourceId: 4,
        parent: {
          amount: -25,
          comment: "+PARENT COMMENT",
          date: "2026-08-19",
          localTime: "18:00:00",
          paymentMethod: "Método padre",
          payee: "=PARENT PAYEE",
          tags: ["@PARENT TAG"],
        },
        payee: "-PAYEE",
        payeeSourceId: 3,
        sourceTransactionId: "parent-uuid",
        splitCount: 2,
        splitIndex: 0,
        tags: ["audit"],
        tagSourceIds: [7],
        transactionId: "leaf-uuid",
        transferAccount: "Cuenta destino",
        valueDate: "2026-08-21",
        valueTime: "00:00:00",
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
      "hora",
      "fecha_valor",
      "hora_valor",
      "estado_myexpenses",
      "metodo_pago",
      "fila_sqlite",
      "contenido_archivado",
      "referencia",
      "moneda_importada",
      "importe_importado",
      "hora_padre",
      "metodo_padre",
      "payee_id",
      "metodo_id",
      "tag_ids",
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
      "18:30:00",
      "2026-08-21",
      "00:00:00",
      "RECONCILED",
      "Tarjeta",
      "",
      "no",
      "",
      "",
      "",
      "18:00:00",
      "Método padre",
      "3",
      "4",
      "7",
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

describe("sortPostings", () => {
  it("orders same-day transactions by their exact operation time", () => {
    const early = {
      ...TRANSACTION_POSTING_FIXTURE,
      epochSeconds: 1_777_008_600,
      id: "early",
      localTime: "08:30:00",
      transactionId: "early",
    };
    const late = {
      ...TRANSACTION_POSTING_FIXTURE,
      epochSeconds: 1_777_045_500,
      id: "late",
      localTime: "18:45:00",
      transactionId: "late",
    };

    expect(sortPostings([late, early], "date", false).map(({ id }) => id)).toEqual([
      "early",
      "late",
    ]);
    expect(sortPostings([early, late], "date", true).map(({ id }) => id)).toEqual([
      "late",
      "early",
    ]);
  });

  it("falls back to local date and time for legacy postings", () => {
    const morning = {
      ...TRANSACTION_POSTING_FIXTURE,
      id: "morning",
      localTime: "09:00:00",
    };
    const afternoon = {
      ...TRANSACTION_POSTING_FIXTURE,
      id: "afternoon",
      localTime: "15:00:00",
    };

    expect(
      sortPostings([afternoon, morning], "date", false).map(({ id }) => id),
    ).toEqual(["morning", "afternoon"]);
  });
});
