import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import type {
    AccountsRegistry,
    CategoriesRegistry,
    CurrencyCode,
    ExchangeRateMode,
    ParsedAccount,
    ParsedDirectTransaction,
    ParsedSplitTransaction,
} from "../types.ts";
import {
    FRANKFURTER_API_URL,
    type Currency,
    type ExchangeRate,
    type ExchangeRateProvider,
    type IsoDate,
} from "./exchange-rates.ts";
import {
    generateStatistics,
    parseIsoDate,
    type StatisticsAtom,
    type StatisticsWithYears,
    toMinorUnits,
} from "./index.ts";

const execFileAsync = promisify(execFile);

const categoriesRegistry: CategoriesRegistry = {
    Gastos: {
        categoryType: "EXPENSE",
        children: {
            Ocio: { categoryType: "NEUTRAL" },
        },
    },
    Ingresos: {
        categoryType: "INCOME",
        children: {
            Nómina: { categoryType: "EXPENSE" },
        },
    },
    Transferencia: { categoryType: "NEUTRAL" },
    "Reajuste*": { categoryType: "NEUTRAL" },
    Unused: { categoryType: "NEUTRAL" },
};

let transactionSequence = 0;

function directTransaction(
    amount: number,
    category: string[],
    options: Partial<ParsedDirectTransaction> = {},
): ParsedDirectTransaction {
    const uuid = options.uuid ?? `transaction-${++transactionSequence}`;
    return {
        uuid,
        date: "2024-01-15",
        amount,
        category,
        sourceTransactionUuid: uuid,
        sourceStatus: "UNRECONCILED",
        splitIndex: null,
        splitCount: null,
        ...options,
    };
}

function splitTransaction(options: {
    amount: number;
    category?: string[];
    date?: IsoDate;
    index: number;
    linked?: boolean;
    parentAmount: number;
    parentDate?: IsoDate;
    sourceUuid: string;
    splitCount: number;
}): ParsedSplitTransaction {
    return {
        uuid: `split-${++transactionSequence}`,
        date: options.date ?? "2024-01-06",
        amount: options.amount,
        category: options.category ?? ["Reajuste*"],
        ...(options.linked ? { transferAccount: "Linked account" } : {}),
        sourceTransactionUuid: options.sourceUuid,
        sourceStatus: "UNRECONCILED",
        splitIndex: options.index,
        splitCount: options.splitCount,
        parent: {
            date: options.parentDate ?? "2024-01-05",
            amount: options.parentAmount,
        },
    };
}

function account(
    uuid: string,
    currency: CurrencyCode,
    transactions: ParsedAccount["transactions"],
    openingBalance = 0,
): ParsedAccount {
    return {
        uuid,
        label: `Account ${uuid}`,
        currency,
        openingBalance,
        transactions,
    };
}

function accountsRegistry(
    accounts: readonly ParsedAccount[],
    debtUuids: readonly string[] = [],
    exchangeRates: Readonly<Record<string, number>> = {},
    exchangeRateModes: Readonly<Record<string, ExchangeRateMode>> = {},
): AccountsRegistry {
    const debts = new Set(debtUuids);
    return {
        version: 2,
        accounts: Object.fromEntries(
            accounts.map((item) => [
                item.uuid,
                {
                    ...(item.currency === "EUR"
                        ? {}
                        : {
                              exchangeRateMode:
                                  exchangeRateModes[item.uuid] ?? "DYNAMIC",
                          }),
                    ...(exchangeRates[item.uuid] === undefined
                        ? {}
                        : { exchangeRateToEur: exchangeRates[item.uuid] }),
                    label: item.label,
                    type: debts.has(item.uuid) ? "DEBT" : "DEFAULT",
                },
            ]),
        ),
    };
}

class FakeRateProvider implements ExchangeRateProvider {
    readonly source = FRANKFURTER_API_URL;
    readonly calls: { base: Currency; date: IsoDate }[] = [];
    activeRequests = 0;
    maxActiveRequests = 0;
    private readonly getRateValue: (
        date: IsoDate,
        base: Currency,
    ) => number;
    private readonly yieldRequest: boolean;

    constructor(
        getRateValue: (date: IsoDate, base: Currency) => number,
        yieldRequest = false,
    ) {
        this.getRateValue = getRateValue;
        this.yieldRequest = yieldRequest;
    }

    async getRate(
        requestedDate: IsoDate,
        base: Currency,
        quote: "EUR",
    ): Promise<ExchangeRate> {
        this.calls.push({ base, date: requestedDate });
        this.activeRequests++;
        this.maxActiveRequests = Math.max(
            this.maxActiveRequests,
            this.activeRequests,
        );
        if (this.yieldRequest) {
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
        this.activeRequests--;
        return {
            base,
            effectiveDate: requestedDate,
            quote,
            rate: this.getRateValue(requestedDate, base),
            requestedDate,
        };
    }
}

function noRatesExpected(): ExchangeRateProvider {
    return new FakeRateProvider(() => {
        throw new Error("Exchange-rate provider should not be called");
    });
}

function assertAtom(
    actual: StatisticsAtom,
    expected: StatisticsAtom,
): void {
    assert.deepEqual(actual, expected);
    assert.equal(
        toMinorUnits(actual.total),
        toMinorUnits(actual.expenses) +
            toMinorUnits(actual.incomes) +
            toMinorUnits(actual.transfers),
    );
}

function assertBalanceInvariant(view: StatisticsWithYears): void {
    assert.equal(
        toMinorUnits(view.historicalFlowBalance),
        toMinorUnits(view.openingBalance) + toMinorUnits(view.all.total),
    );
}

function sumAtoms(atoms: readonly StatisticsAtom[]): StatisticsAtom {
    const cents = atoms.reduce(
        (sum, atom) => ({
            total: sum.total + toMinorUnits(atom.total),
            expenses: sum.expenses + toMinorUnits(atom.expenses),
            incomes: sum.incomes + toMinorUnits(atom.incomes),
            transfers: sum.transfers + toMinorUnits(atom.transfers),
        }),
        { total: 0, expenses: 0, incomes: 0, transfers: 0 },
    );
    return {
        total: cents.total / 100,
        expenses: cents.expenses / 100,
        incomes: cents.incomes / 100,
        transfers: cents.transfers / 100,
    };
}

test("classifies by root category, keeps sparse buckets, and preserves view invariants", async () => {
    const defaultAccount = account(
        "default",
        "EUR",
        [
            directTransaction(-10.01, ["Gastos", "Ocio"]),
            directTransaction(2, ["Gastos", "Ocio"]),
            directTransaction(100, ["Ingresos", "Nómina"], {
                date: "2024-01-31",
            }),
            directTransaction(-5, ["Ingresos", "Nómina"], {
                date: "2024-01-31",
            }),
            directTransaction(-3, ["Reajuste*"], { date: "2024-01-31" }),
            directTransaction(4, ["Reajuste*"], { date: "2024-01-31" }),
            directTransaction(7, ["Transferencia"], { date: "2024-01-31" }),
            directTransaction(999, ["unknown void category"], {
                date: "not-a-date" as IsoDate,
                sourceStatus: "VOID",
            }),
        ],
        100,
    );
    const debtAccount = account(
        "debt",
        "EUR",
        [
            directTransaction(-20, ["Gastos", "Ocio"], {
                date: "2024-12-01",
            }),
        ],
        -20,
    );
    const data = [defaultAccount, debtAccount];
    const result = await generateStatistics(
        data,
        accountsRegistry(data, [debtAccount.uuid]),
        categoriesRegistry,
        noRatesExpected(),
    );

    assert.deepEqual(result.metadata, {
        currency: "EUR",
        exchangeRates: {
            source: "https://api.frankfurter.dev/v1",
            staticRates: "accountsRegistry",
            version: 1,
        },
        views: {
            debtsStatistics: "debtsOnly",
            statistics: "appCompatible",
            statisticsWithDebts: "realCashFlow",
        },
    });
    assertAtom(result.statistics.all, {
        total: 74.99,
        expenses: -31.01,
        incomes: 99,
        transfers: 7,
    });
    assertAtom(result.statisticsWithDebts.all, {
        total: 94.99,
        expenses: -11.01,
        incomes: 99,
        transfers: 7,
    });
    assertAtom(result.debtsStatistics.all, {
        total: -20,
        expenses: -20,
        incomes: 0,
        transfers: 0,
    });
    assert.deepEqual(
        {
            accountValuationBalance: result.statistics.accountValuationBalance,
            historicalFlowBalance: result.statistics.historicalFlowBalance,
            openingBalance: result.statistics.openingBalance,
        },
        {
            accountValuationBalance: 154.99,
            historicalFlowBalance: 154.99,
            openingBalance: 80,
        },
    );
    assert.deepEqual(
        {
            accountValuationBalance:
                result.statisticsWithDebts.accountValuationBalance,
            historicalFlowBalance:
                result.statisticsWithDebts.historicalFlowBalance,
            openingBalance: result.statisticsWithDebts.openingBalance,
        },
        {
            accountValuationBalance: 194.99,
            historicalFlowBalance: 194.99,
            openingBalance: 100,
        },
    );
    assert.deepEqual(
        {
            accountValuationBalance:
                result.debtsStatistics.accountValuationBalance,
            historicalFlowBalance:
                result.debtsStatistics.historicalFlowBalance,
            openingBalance: result.debtsStatistics.openingBalance,
        },
        {
            accountValuationBalance: -40,
            historicalFlowBalance: -40,
            openingBalance: -20,
        },
    );
    for (const view of [
        result.statistics,
        result.statisticsWithDebts,
        result.debtsStatistics,
    ]) {
        assertBalanceInvariant(view);
    }
    assert.equal(
        toMinorUnits(result.statistics.openingBalance),
        toMinorUnits(result.statisticsWithDebts.openingBalance) +
            toMinorUnits(result.debtsStatistics.openingBalance),
    );
    assert.equal(
        toMinorUnits(result.statistics.accountValuationBalance),
        toMinorUnits(result.statisticsWithDebts.accountValuationBalance) +
            toMinorUnits(result.debtsStatistics.accountValuationBalance),
    );

    assertAtom(
        result.statistics.categories.Gastos!.subCategories!.Ocio!.statistics,
        { total: -28.01, expenses: -28.01, incomes: 0, transfers: 0 },
    );
    assertAtom(
        result.statistics.categories.Ingresos!.subCategories!.Nómina!.statistics,
        { total: 95, expenses: 0, incomes: 95, transfers: 0 },
    );
    assertAtom(result.statistics.categories["Reajuste*"]!.statistics, {
        total: 1,
        expenses: -3,
        incomes: 4,
        transfers: 0,
    });
    assertAtom(result.statistics.categories.Transferencia!.statistics, {
        total: 7,
        expenses: 0,
        incomes: 0,
        transfers: 7,
    });
    assert.equal(result.statistics.categories.Unused, undefined);

    const year = result.statistics.years[2024]!;
    assert.deepEqual(Object.keys(year.months), ["1", "12"]);
    assert.equal(year.months[1]!.days[31]!.statistics.all.total, 103);
    assert.equal(year.months[12]!.days[1]!.statistics.all.total, -20);
    assertAtom(
        sumAtoms(Object.values(result.statistics.years).map((item) => item.statistics.all)),
        result.statistics.all,
    );
    assertAtom(
        sumAtoms(Object.values(year.months).map((item) => item.statistics.all)),
        year.statistics.all,
    );
    for (const month of Object.values(year.months)) {
        assertAtom(
            sumAtoms(Object.values(month.days).map((item) => item.statistics.all)),
            month.statistics.all,
        );
    }
    assertAtom(
        sumAtoms([
            result.statisticsWithDebts.all,
            result.debtsStatistics.all,
        ]),
        result.statistics.all,
    );
});

test("converts each foreign posting once and deduplicates rate requests", async () => {
    const foreignAccount = account(
        "gbp",
        "GBP",
        [
            directTransaction(1281.04, ["Transferencia"], {
                date: "2024-03-18",
            }),
            directTransaction(0.01, ["Reajuste*"], { date: "2024-03-18" }),
        ],
        -1281.05,
    );
    const provider = new FakeRateProvider(() => 1.1692);
    const result = await generateStatistics(
        [foreignAccount],
        accountsRegistry(
            [foreignAccount],
            [],
            { [foreignAccount.uuid]: 1.1692 },
        ),
        categoriesRegistry,
        provider,
    );

    assert.equal(provider.calls.length, 1);
    assert.deepEqual(provider.calls[0], {
        base: "GBP",
        date: "2024-03-18",
    });
    assertAtom(result.statistics.all, {
        total: 1497.8,
        expenses: 0,
        incomes: 0.01,
        transfers: 1497.79,
    });
});

test("uses the account static rate for linked postings and foreign opening balances", async () => {
    const foreignAccount = account(
        "static-gbp",
        "GBP",
        [
            directTransaction(5, ["Transferencia"], {
                date: "2024-03-18",
                transferAccount: "EUR account",
            }),
            directTransaction(-2, ["Gastos", "Ocio"], {
                date: "2024-03-18",
                transferAccount: "EUR account",
            }),
            directTransaction(1, ["Transferencia"], {
                date: "2024-03-18",
            }),
        ],
        -4,
    );
    const provider = new FakeRateProvider(() => 2);
    const result = await generateStatistics(
        [foreignAccount],
        accountsRegistry(
            [foreignAccount],
            [],
            { [foreignAccount.uuid]: 1.2 },
        ),
        categoriesRegistry,
        provider,
    );

    assert.deepEqual(provider.calls, [{ base: "GBP", date: "2024-03-18" }]);
    assertAtom(result.statistics.all, {
        total: 5.6,
        expenses: -2.4,
        incomes: 0,
        transfers: 8,
    });
    assert.equal(result.statistics.openingBalance, -4.8);
    assert.equal(result.statistics.historicalFlowBalance, 0.8);
    assert.equal(result.statistics.accountValuationBalance, 0);
});

test("STATIC mode converts every foreign posting without historical requests", async () => {
    const zeroParentUuid = "static-zero-parent";
    const foreignAccount = account(
        "static-mode-gbp",
        "GBP",
        [
            directTransaction(5, ["Transferencia"]),
            directTransaction(-2, ["Gastos", "Ocio"], {
                transferAccount: "EUR account",
            }),
            splitTransaction({
                amount: -0.01,
                index: 0,
                parentAmount: 0,
                sourceUuid: zeroParentUuid,
                splitCount: 2,
            }),
            splitTransaction({
                amount: 0.01,
                index: 1,
                linked: true,
                parentAmount: 0,
                sourceUuid: zeroParentUuid,
                splitCount: 2,
            }),
        ],
        10,
    );
    const provider = new FakeRateProvider(() => {
        throw new Error("STATIC accounts must not request historical rates");
    });
    const result = await generateStatistics(
        [foreignAccount],
        accountsRegistry(
            [foreignAccount],
            [],
            { [foreignAccount.uuid]: 1.2 },
            { [foreignAccount.uuid]: "STATIC" },
        ),
        categoriesRegistry,
        provider,
    );

    assert.equal(provider.calls.length, 0);
    assertAtom(result.statistics.all, {
        total: 3.6,
        expenses: -2.41,
        incomes: 0.01,
        transfers: 6,
    });
    assert.equal(result.statistics.openingBalance, 12);
    assert.equal(result.statistics.historicalFlowBalance, 15.6);
    assert.equal(result.statistics.accountValuationBalance, 15.6);
});

test("requires a static rate for linked foreign postings and non-zero openings", async () => {
    const linkedAccount = account("missing-linked-rate", "GBP", [
        directTransaction(1, ["Transferencia"], {
            transferAccount: "EUR account",
        }),
    ]);
    const openingAccount = account("missing-opening-rate", "USD", [], 1);
    const balanceAccount = account("missing-balance-rate", "GBP", [
        directTransaction(1, ["Reajuste*"]),
    ]);
    const missingModeAccount = account("missing-mode", "GBP", []);
    const staticWithoutRateAccount = account("missing-static-rate", "GBP", []);
    const provider = new FakeRateProvider(() => 1);

    await assert.rejects(
        generateStatistics(
            [linkedAccount],
            accountsRegistry([linkedAccount]),
            categoriesRegistry,
            provider,
        ),
        /linked foreign-currency posting requires a static EUR exchange rate/,
    );
    await assert.rejects(
        generateStatistics(
            [openingAccount],
            accountsRegistry([openingAccount]),
            categoriesRegistry,
            provider,
        ),
        /static EUR exchange rate for its non-zero opening balance/,
    );
    await assert.rejects(
        generateStatistics(
            [balanceAccount],
            accountsRegistry([balanceAccount]),
            categoriesRegistry,
            provider,
        ),
        /non-zero DYNAMIC balance.*does not contain its latest EUR valuation rate/,
    );
    const missingModeRegistry = accountsRegistry([missingModeAccount]);
    delete missingModeRegistry.accounts[missingModeAccount.uuid]!
        .exchangeRateMode;
    await assert.rejects(
        generateStatistics(
            [missingModeAccount],
            missingModeRegistry,
            categoriesRegistry,
            provider,
        ),
        /requires an exchange-rate mode/,
    );
    await assert.rejects(
        generateStatistics(
            [staticWithoutRateAccount],
            accountsRegistry(
                [staticWithoutRateAccount],
                [],
                {},
                { [staticWithoutRateAccount.uuid]: "STATIC" },
            ),
            categoriesRegistry,
            provider,
        ),
        /requires a static EUR exchange rate in STATIC mode/,
    );
    assert.equal(provider.calls.length, 0);
});

test("uses the My Expenses parent-ratio formula for foreign splits", async () => {
    const sourceUuid = "split-parent";
    const foreignAccount = account(
        "gbp-split",
        "GBP",
        [
            splitTransaction({
                amount: 0.01,
                index: 0,
                parentAmount: 0.02,
                sourceUuid,
                splitCount: 2,
                linked: true,
            }),
            splitTransaction({
                amount: 0.01,
                index: 1,
                parentAmount: 0.02,
                sourceUuid,
                splitCount: 2,
                linked: true,
            }),
        ],
        -0.02,
    );
    const provider = new FakeRateProvider(() => 0.5);
    const result = await generateStatistics(
        [foreignAccount],
        accountsRegistry(
            [foreignAccount],
            [],
            { [foreignAccount.uuid]: 10 },
        ),
        categoriesRegistry,
        provider,
    );

    assert.deepEqual(provider.calls, [{ base: "GBP", date: "2024-01-05" }]);
    assertAtom(result.statistics.all, {
        total: 0.02,
        expenses: 0,
        incomes: 0.02,
        transfers: 0,
    });
    assert.equal(
        result.statistics.years[2024]!.months[1]!.days[6]!.statistics.all.total,
        0.02,
    );
    assert.equal(result.statistics.accountValuationBalance, 0);
});

test("rejects foreign zero-parent splits before requesting a rate", async () => {
    const sourceUuid = "zero-parent";
    const foreignAccount = account("zero-gbp", "GBP", [
        splitTransaction({
            amount: -0.01,
            index: 0,
            parentAmount: 0,
            sourceUuid,
            splitCount: 2,
        }),
        splitTransaction({
            amount: 0.01,
            index: 1,
            parentAmount: 0,
            sourceUuid,
            splitCount: 2,
        }),
    ]);
    const provider = new FakeRateProvider(() => 1);

    await assert.rejects(
        generateStatistics(
            [foreignAccount],
            accountsRegistry([foreignAccount]),
            categoriesRegistry,
            provider,
        ),
        /zero parent amount/,
    );
    assert.equal(provider.calls.length, 0);
});

test("limits FX prefetch to four requests while deduplicating keys", async () => {
    const transactions = Array.from({ length: 6 }, (_, index) =>
        directTransaction(0.01, ["Reajuste*"], {
            date: `2024-02-0${index + 1}` as IsoDate,
        }),
    );
    transactions.push(
        directTransaction(0.01, ["Reajuste*"], { date: "2024-02-01" }),
    );
    const foreignAccount = account("concurrency", "GBP", transactions, -0.07);
    const provider = new FakeRateProvider(() => 1, true);
    const result = await generateStatistics(
        [foreignAccount],
        accountsRegistry(
            [foreignAccount],
            [],
            { [foreignAccount.uuid]: 1 },
        ),
        categoriesRegistry,
        provider,
    );

    assert.equal(provider.calls.length, 6);
    assert.equal(provider.maxActiveRequests, 4);
    assert.equal(result.statistics.all.incomes, 0.07);
});

test("waits for in-flight FX requests before propagating a prefetch error", async () => {
    const transactions = Array.from({ length: 6 }, (_, index) =>
        directTransaction(0.01, ["Reajuste*"], {
            date: `2024-03-0${index + 1}` as IsoDate,
        }),
    );
    const foreignAccount = account(
        "failed-prefetch",
        "GBP",
        transactions,
        -0.06,
    );
    let activeRequests = 0;
    let calls = 0;
    const provider: ExchangeRateProvider = {
        source: FRANKFURTER_API_URL,
        async getRate(requestedDate, base, quote) {
            calls++;
            activeRequests++;
            await new Promise<void>((resolve) => setImmediate(resolve));
            if (requestedDate === "2024-03-01") {
                activeRequests--;
                throw new Error("expected rate failure");
            }
            await new Promise<void>((resolve) => setImmediate(resolve));
            activeRequests--;
            return {
                base,
                effectiveDate: requestedDate,
                quote,
                rate: 1,
                requestedDate,
            };
        },
    };

    await assert.rejects(
        generateStatistics(
            [foreignAccount],
            accountsRegistry(
                [foreignAccount],
                [],
                { [foreignAccount.uuid]: 1 },
            ),
            categoriesRegistry,
            provider,
        ),
        /expected rate failure/,
    );
    assert.equal(activeRequests, 0);
    assert.equal(calls, 4);
});

test("fails fast with contextual errors for invalid dates, money, accounts, and categories", async () => {
    assert.equal(parseIsoDate("2024-02-29").month, 2);
    assert.equal(parseIsoDate("2024-12-31").month, 12);
    assert.throws(() => parseIsoDate("2023-02-29"), /invalid calendar date/);
    assert.throws(() => parseIsoDate("2024-1-01"), /invalid ISO date/);
    assert.throws(() => toMinorUnits(1.001), /two decimal places/);

    const invalidDateAccount = account("invalid-date", "EUR", [
        directTransaction(1, ["Reajuste*"], {
            date: "2024-02-30" as IsoDate,
        }),
    ]);
    await assert.rejects(
        generateStatistics(
            [invalidDateAccount],
            accountsRegistry([invalidDateAccount]),
            categoriesRegistry,
            noRatesExpected(),
        ),
        /Account "Account invalid-date".*invalid calendar date/,
    );

    const unknownAccount = account("unknown-account", "EUR", [
        directTransaction(1, ["Reajuste*"]),
    ]);
    await assert.rejects(
        generateStatistics(
            [unknownAccount],
            { version: 2, accounts: {} },
            categoriesRegistry,
            noRatesExpected(),
        ),
        /missing from accounts registry/,
    );
    await assert.rejects(
        generateStatistics(
            [unknownAccount],
            {
                version: 2,
                accounts: { [unknownAccount.uuid]: null },
            } as unknown as AccountsRegistry,
            categoriesRegistry,
            noRatesExpected(),
        ),
        /invalid accounts registry entry/,
    );

    const unknownCategory = account("unknown-category", "EUR", [
        directTransaction(1, ["Gastos", "Missing"]),
    ]);
    await assert.rejects(
        generateStatistics(
            [unknownCategory],
            accountsRegistry([unknownCategory]),
            categoriesRegistry,
            noRatesExpected(),
        ),
        /unknown category path/,
    );
});

test("importing statistics modules has no filesystem side effects", async () => {
    const directory = await mkdtemp(join(tmpdir(), "statistics-import-test-"));
    const dataDirectory = join(directory, "data");
    const statisticsPath = join(dataDirectory, "statistics.json");
    const sentinel = "do not overwrite";

    try {
        await mkdir(dataDirectory);
        await writeFile(statisticsPath, sentinel, "utf8");
        const nonce = Date.now();
        const moduleUrls = ["index.ts", "cli.ts"].map(
            (moduleName) =>
                `${new URL(moduleName, import.meta.url).href}?import-test=${nonce}`,
        );
        await execFileAsync(
            process.execPath,
            [
                "--import",
                import.meta.resolve("tsx"),
                "--input-type=module",
                "--eval",
                `await Promise.all(${JSON.stringify(moduleUrls)}.map((url) => import(url)))`,
            ],
            { cwd: directory },
        );
        assert.equal(await readFile(statisticsPath, "utf8"), sentinel);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});
