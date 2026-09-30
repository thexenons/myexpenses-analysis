import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPostingsCsv,
  downloadPostingsCsv,
  sortPostings,
} from "./TransactionsPage.helpers.ts";
import { TRANSACTION_POSTING_FIXTURE } from "./TransactionsPage.test.helpers.ts";

describe("createPostingsCsv", () => {
  it("leaves an unavailable exchange rate empty while preserving a zero equivalent", () => {
    const csv = createPostingsCsv([{ ...TRANSACTION_POSTING_FIXTURE, exchangeRateToEur: null, amountEurMinor: 0 }]);
    const [header, row] = csv.split("\n").map((line) => line.split(","));
    expect(row?.[header!.indexOf("tasa_eur")]).toBe("");
    expect(row?.[header!.indexOf("importe_eur")]).toBe("0");
  });

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
      "cuenta_origen_uuid",
      "cuenta_origen",
      "cuenta_destino_uuid",
      "cuenta_destino",
      "contrapartida_id",
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
      "",
      "",
      "",
      "",
      "",
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

describe("downloadPostingsCsv", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let sequence = 0;
    createObjectURL = vi.fn<typeof URL.createObjectURL>(() => `blob:csv-${++sequence}`);
    revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.querySelectorAll('a[download="movimientos-filtrados.csv"]').forEach((anchor) => anchor.remove());
  });

  it("downloads the same UTF-8 CSV and releases its temporary resources", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
    });
    const postings = [TRANSACTION_POSTING_FIXTURE];

    downloadPostingsCsv(postings);

    const clickedAnchor = clickSpy.mock.instances[0] as HTMLAnchorElement | undefined;
    expect(clickedAnchor?.download).toBe("movimientos-filtrados.csv");
    expect(clickedAnchor?.href).toBe("blob:csv-1");
    expect(clickedAnchor?.isConnected).toBe(false);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:csv-1");
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.subarray(3))).toBe(createPostingsCsv(postings));
  });

  it("releases resources and preserves each click error across repeated attempts", () => {
    const failures = [new Error("first click failed"), new Error("second click failed")];
    let attempt = 0;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      const failure = failures[attempt++];
      if (failure) throw failure;
    });

    for (const failure of failures) {
      let caught: unknown;
      try {
        downloadPostingsCsv([TRANSACTION_POSTING_FIXTURE]);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(failure);
      expect(document.querySelectorAll('a[download="movimientos-filtrados.csv"]')).toHaveLength(0);
    }
    downloadPostingsCsv([TRANSACTION_POSTING_FIXTURE]);
    expect(document.querySelectorAll('a[download="movimientos-filtrados.csv"]')).toHaveLength(0);
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual([
      "blob:csv-1", "blob:csv-2", "blob:csv-3",
    ]);
  });

  it("revokes the URL if attaching the anchor fails", () => {
    const failure = new Error("append failed");
    vi.spyOn(document.body, "append").mockImplementation(() => { throw failure; });

    let caught: unknown;
    try {
      downloadPostingsCsv([TRANSACTION_POSTING_FIXTURE]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:csv-1");
    expect(document.querySelectorAll('a[download="movimientos-filtrados.csv"]')).toHaveLength(0);
  });

  it("revokes the URL even if anchor removal fails", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const failure = new Error("remove failed");
    vi.spyOn(Element.prototype, "remove").mockImplementation(() => { throw failure; });

    expect(() => downloadPostingsCsv([TRANSACTION_POSTING_FIXTURE])).toThrow(failure);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:csv-1");
  });
});

describe("sortPostings", () => {
  it("orders by value date when that is the selected date basis", () => {
    const operationFirst = { ...TRANSACTION_POSTING_FIXTURE, id: "operation-first", date: "2026-08-01" as const, valueDate: "2026-08-05" as const };
    const valueFirst = { ...TRANSACTION_POSTING_FIXTURE, id: "value-first", date: "2026-08-02" as const, valueDate: "2026-08-03" as const };
    expect(sortPostings([operationFirst, valueFirst], "date", false, "value").map(({ id }) => id)).toEqual(["value-first", "operation-first"]);
  });

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
