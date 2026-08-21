import { vi } from "vitest";

const DATA_BY_FILE: Readonly<Record<string, unknown>> = {
  "accounts.json": {
    version: 2,
    accounts: {
      cash: { label: "Cuenta principal", type: "DEFAULT" },
      debt: { label: "Persona", type: "DEBT" },
    },
  },
  "categories.json": {
    Gastos: { categoryType: "EXPENSE" },
    Ingresos: { categoryType: "INCOME" },
    Transferencia: { categoryType: "TRANSFER" },
  },
  "parsed-data.json": [
    {
      uuid: "cash",
      label: "Cuenta principal",
      currency: "EUR",
      openingBalance: 100,
      transactions: [
        {
          uuid: "income",
          date: "2026-01-01",
          amount: 50,
          category: ["Ingresos"],
          payee: "Empresa",
          sourceTransactionUuid: "income",
          sourceStatus: "RECONCILED",
          splitIndex: null,
          splitCount: null,
        },
        {
          uuid: "expense",
          date: "2026-01-02",
          amount: -20,
          category: ["Gastos"],
          payee: "Tienda",
          sourceTransactionUuid: "expense",
          sourceStatus: "UNRECONCILED",
          splitIndex: null,
          splitCount: null,
        },
      ],
    },
    {
      uuid: "debt",
      label: "Persona",
      currency: "EUR",
      openingBalance: 0,
      transactions: [
        {
          uuid: "debt-movement",
          date: "2026-01-02",
          amount: 20,
          category: ["Gastos"],
          sourceTransactionUuid: "debt-movement",
          sourceStatus: "UNRECONCILED",
          splitIndex: null,
          splitCount: null,
        },
      ],
    },
  ],
};

interface AppFetchMockOptions {
  readonly failOnceFor?: string;
}

export function installAppFetchMock(options: AppFetchMockOptions = {}) {
  let failedFile = false;
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const pathname = new URL(String(input), "http://localhost").pathname;
    const fileName = pathname.split("/").at(-1) ?? "";
    if (fileName === options.failOnceFor && !failedFile) {
      failedFile = true;
      return new Response("Service unavailable", { status: 503 });
    }
    const data = DATA_BY_FILE[fileName];
    if (data === undefined) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
