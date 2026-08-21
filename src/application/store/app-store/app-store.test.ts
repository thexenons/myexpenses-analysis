import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../ports/dataset-repository.ts";
import type { AppDataset } from "../../../domain/analytics/types.ts";
import { APP_STORE_STORAGE_NAME } from "./app-store.helpers.ts";
import { createAppStore } from "./app-store.ts";

function datasetFixture(): AppDataset {
  return {
    accounts: {
      version: 2,
      accounts: {
        account: { label: "Cuenta", type: "DEFAULT" },
        debt: { label: "Deuda", type: "DEBT" },
      },
    },
    categories: {
      "Reajuste*": { categoryType: "NEUTRAL" },
    },
    parsedData: [
      {
        uuid: "account",
        label: "Cuenta",
        currency: "EUR",
        openingBalance: 0,
        transactions: [
          {
            uuid: "posting",
            date: "2026-01-01",
            amount: 10,
            category: ["Reajuste*"],
            sourceTransactionUuid: "posting",
            sourceStatus: "UNRECONCILED",
            splitIndex: null,
            splitCount: null,
          },
        ],
      },
      {
        uuid: "debt",
        label: "Deuda",
        currency: "EUR",
        openingBalance: 0,
        transactions: [],
      },
    ],
  };
}

describe("AppStore", () => {
  beforeEach(() => window.localStorage.clear());

  it("loads and normalizes data through the repository port", async () => {
    const repository: DatasetRepository = {
      load: vi.fn().mockResolvedValue(datasetFixture()),
    };
    const store = createAppStore(repository, window.localStorage);

    await store.getState().actions.initialize();

    expect(repository.load).toHaveBeenCalledOnce();
    expect(store.getState().loadPhase).toBe("ready");
    expect(store.getState().analytics?.postings).toHaveLength(1);
  });

  it("keeps filter mutations inside the store action boundary", () => {
    const repository: DatasetRepository = { load: vi.fn() };
    const store = createAppStore(repository, window.localStorage);

    store.getState().actions.patchFilters({ search: "mercado" });
    store.getState().actions.setAccountIds(["one", "two"]);
    store.getState().actions.openFilterDrawer();

    expect(store.getState().filters.search).toBe("mercado");
    expect(store.getState().filters.accountIds).toEqual(["one", "two"]);
    expect(store.getState().filterDrawerOpen).toBe(true);

    store.getState().actions.clearFilters();
    expect(store.getState().filters.search).toBe("");
  });

  it("prunes stale and scope-incompatible account filters", async () => {
    const repository: DatasetRepository = {
      load: vi.fn().mockResolvedValue(datasetFixture()),
    };
    const store = createAppStore(repository, window.localStorage);
    store.getState().actions.setAccountIds(["account", "debt", "missing"]);

    await store.getState().actions.initialize();

    expect(store.getState().filters.accountIds).toEqual(["account", "debt"]);
    store.getState().actions.patchFilters({ scope: "realCashFlow" });
    expect(store.getState().filters.accountIds).toEqual(["account"]);
    store.getState().actions.setAccountIds(["account", "debt"]);
    expect(store.getState().filters.accountIds).toEqual(["account"]);
    store.getState().actions.patchFilters({ scope: "debtsOnly" });
    expect(store.getState().filters.accountIds).toEqual([]);
  });

  it("migrates and validates persisted UI state before hydration", async () => {
    window.localStorage.setItem(
      APP_STORE_STORAGE_NAME,
      JSON.stringify({
        version: 1,
        state: {
          filters: {
            scope: "debtsOnly",
            dateRange: { from: "not-a-date", to: "2026-01-31" },
            accountIds: ["debt", "missing", 42],
            statuses: ["VOID", "UNKNOWN"],
            search: 42,
          },
          granularity: "quarter",
          page: "unknown",
        },
      }),
    );
    const repository: DatasetRepository = {
      load: vi.fn().mockResolvedValue(datasetFixture()),
    };
    const store = createAppStore(repository, window.localStorage);
    await store.persist.rehydrate();

    expect(store.getState().filters).toMatchObject({
      scope: "debtsOnly",
      dateRange: { from: null, to: "2026-01-31" },
      accountIds: ["debt", "missing"],
      statuses: ["VOID"],
      search: "",
      linked: "all",
    });
    expect(store.getState().granularity).toBe("month");
    expect(store.getState()).not.toHaveProperty("page");

    await store.getState().actions.initialize();
    expect(store.getState().filters.accountIds).toEqual(["debt"]);
  });

  it("exposes repository failures without leaking thrown values", async () => {
    const repository: DatasetRepository = {
      load: vi.fn().mockRejectedValue(new Error("dataset unavailable")),
    };
    const store = createAppStore(repository, window.localStorage);

    await store.getState().actions.initialize();

    expect(store.getState().loadPhase).toBe("error");
    expect(store.getState().error).toBe("dataset unavailable");
  });
});
