import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type {
    AccountsRegistry,
    CategoriesRegistry,
    ParsedData,
} from "../types.ts";
import {
    FRANKFURTER_API_URL,
    type ExchangeRateProvider,
} from "./exchange-rates.ts";
import { generateStatistics } from "./index.ts";

const dataUrl = new URL("../../data/", import.meta.url);

async function readData<T>(name: string): Promise<T> {
    return JSON.parse(
        await readFile(fileURLToPath(new URL(name, dataUrl)), "utf8"),
    ) as T;
}

test("STATIC foreign accounts reproduce the official EUR statistics without historical rates", async () => {
    const [parsedData, accountsRegistry, categoriesRegistry] = await Promise.all([
        readData<ParsedData>("parsed-data.json"),
        readData<AccountsRegistry>("accounts.json"),
        readData<CategoriesRegistry>("categories.json"),
    ]);

    const provider: ExchangeRateProvider = {
        source: FRANKFURTER_API_URL,
        async getRate() {
            throw new Error("STATIC foreign accounts must not request historical rates");
        },
    };
    const statistics = await generateStatistics(
        parsedData,
        accountsRegistry,
        categoriesRegistry,
        provider,
    );
    assert.equal(
        JSON.stringify(statistics),
        await readFile(fileURLToPath(new URL("statistics.json", dataUrl)), "utf8"),
    );

    assert.deepEqual(statistics.statistics.all, {
        total: 39_544.7,
        expenses: -49_910.31,
        incomes: 87_634.05,
        transfers: 1_820.96,
    });
    assert.equal(statistics.statistics.accountValuationBalance, 78_755.6);
    assert.equal(statistics.statistics.openingBalance, 39_210.91);
    assert.equal(statistics.statistics.historicalFlowBalance, 78_755.61);
    assert.deepEqual(statistics.statisticsWithDebts.all, {
        total: -11_343.63,
        expenses: -100_684.39,
        incomes: 87_633.95,
        transfers: 1_706.81,
    });
    assert.equal(
        statistics.statisticsWithDebts.accountValuationBalance,
        4_326.65,
    );
    assert.equal(statistics.statisticsWithDebts.openingBalance, 15_670.29);
    assert.equal(
        statistics.statisticsWithDebts.historicalFlowBalance,
        4_326.66,
    );
    assert.deepEqual(statistics.debtsStatistics.all, {
        total: 50_888.33,
        expenses: 50_774.08,
        incomes: 0.1,
        transfers: 114.15,
    });
    assert.equal(statistics.debtsStatistics.accountValuationBalance, 74_428.95);
    assert.equal(statistics.debtsStatistics.openingBalance, 23_540.62);
    assert.equal(statistics.debtsStatistics.historicalFlowBalance, 74_428.95);
});
