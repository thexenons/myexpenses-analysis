import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import initSqlJs from "sql.js";

import { adaptV189 } from "./adapter.ts";
import { CATEGORY_TYPE } from "./models.ts";
import { V189SchemaError, validateV189Database } from "./schema.ts";

const wasmPath = fileURLToPath(
    new URL("../../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ locateFile: () => wasmPath });

function fixtureDatabase(): initSqlJs.Database {
    const database = new SQL.Database();
    database.run(`
        PRAGMA user_version = 189;

        CREATE TABLE currency (
            _id INTEGER PRIMARY KEY,
            code TEXT NOT NULL,
            label TEXT,
            fraction_digits INTEGER,
            symbol TEXT,
            commodity_type TEXT
        );
        CREATE TABLE account_types (
            _id INTEGER PRIMARY KEY,
            label TEXT NOT NULL,
            isAsset INTEGER NOT NULL,
            supportsReconciliation INTEGER NOT NULL
        );
        CREATE TABLE account_flags (
            _id INTEGER PRIMARY KEY,
            visible INTEGER NOT NULL
        );
        CREATE TABLE accounts (
            _id INTEGER PRIMARY KEY,
            uuid TEXT,
            label TEXT NOT NULL,
            description TEXT,
            currency TEXT NOT NULL,
            type INTEGER NOT NULL,
            flag INTEGER NOT NULL,
            opening_balance INTEGER,
            exclude_from_totals INTEGER NOT NULL,
            dynamic INTEGER NOT NULL,
            parent_id INTEGER
        );
        CREATE TABLE categories (
            _id INTEGER PRIMARY KEY,
            uuid TEXT,
            label TEXT NOT NULL,
            parent_id INTEGER,
            type INTEGER,
            color INTEGER,
            icon TEXT
        );
        CREATE TABLE transactions (
            _id INTEGER PRIMARY KEY,
            uuid TEXT,
            comment TEXT,
            date INTEGER NOT NULL,
            value_date INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            cat_id INTEGER,
            account_id INTEGER NOT NULL,
            payee_id INTEGER,
            transfer_peer INTEGER,
            transfer_account INTEGER,
            method_id INTEGER,
            parent_id INTEGER,
            status INTEGER,
            cr_status TEXT NOT NULL,
            number TEXT,
            original_amount INTEGER,
            original_currency TEXT,
            debt_id INTEGER
        );
        CREATE TABLE payee (
            _id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            short_name TEXT,
            parent_id INTEGER
        );
        CREATE TABLE paymentmethods (
            _id INTEGER PRIMARY KEY,
            label TEXT NOT NULL,
            is_numbered INTEGER,
            type INTEGER,
            icon TEXT
        );
        CREATE TABLE tags (
            _id INTEGER PRIMARY KEY,
            label TEXT NOT NULL,
            color INTEGER
        );
        CREATE TABLE transactions_tags (transaction_id INTEGER, tag_id INTEGER);
        CREATE TABLE equivalent_amounts (
            transaction_id INTEGER,
            currency TEXT,
            equivalent_amount INTEGER
        );
        CREATE TABLE account_exchangerates (
            account_id INTEGER,
            currency_self TEXT,
            currency_other TEXT,
            exchange_rate REAL
        );
        CREATE TABLE prices (
            commodity TEXT,
            currency TEXT,
            date TEXT,
            source TEXT,
            value REAL
        );
        CREATE TABLE budgets (
            _id INTEGER PRIMARY KEY,
            uuid TEXT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            grouping TEXT NOT NULL,
            account_id INTEGER,
            currency TEXT,
            start TEXT,
            end TEXT,
            is_default INTEGER NOT NULL
        );
        CREATE TABLE budget_allocations (
            budget_id INTEGER,
            cat_id INTEGER,
            year INTEGER,
            second INTEGER,
            budget INTEGER,
            rollOverPrevious INTEGER,
            rollOverNext INTEGER,
            oneTime INTEGER
        );

        INSERT INTO currency VALUES
            (1, 'EUR', 'Euro', 2, '€', 'FIAT'),
            (2, 'USD', 'Dollar', 2, '$', 'FIAT'),
            (3, 'ZZZ', 'Unused', NULL, NULL, NULL);
        INSERT INTO account_types VALUES
            (1, 'CASH', 1, 0),
            (5, 'LIABILITY', 0, 0);
        INSERT INTO account_flags VALUES (1, 1);
        INSERT INTO accounts VALUES
            (1, 'account-real', 'Real', NULL, 'EUR', 1, 1, 100, 0, 0, NULL),
            (2, 'account-debt', 'Debt', NULL, 'EUR', 5, 1, 200, 0, 0, NULL),
            (3, 'account-static', 'Static FX', NULL, 'USD', 1, 1, 0, 0, 0, NULL),
            (4, 'account-dynamic', 'Dynamic FX', NULL, 'USD', 1, 1, 0, 0, 1, NULL);
        INSERT INTO account_exchangerates VALUES
            (3, 'USD', 'EUR', 2.0),
            (4, 'USD', 'EUR', 2.0);

        INSERT INTO categories VALUES
            (0, NULL, 'Split', 0, NULL, NULL, NULL),
            (10, 'cat-expense', 'Expense', NULL, 1, NULL, NULL),
            (11, 'cat-income', 'Income', NULL, 2, NULL, NULL),
            (12, 'cat-transfer', 'Transfer', NULL, 0, NULL, NULL),
            (13, 'cat-neutral', 'Neutral', NULL, 3, NULL, NULL),
            (14, 'cat-mismatched-child', 'Mismatched child', 10, 2, NULL, NULL);
        INSERT INTO payee VALUES
            (1, 'Child payee', NULL, NULL),
            (2, 'Parent payee', NULL, NULL);
        INSERT INTO paymentmethods VALUES
            (1, 'Child method', 0, -1, NULL),
            (2, 'Parent method', 0, 0, NULL);
        INSERT INTO tags VALUES
            (1, 'Child tag', NULL),
            (2, 'Parent tag', NULL);

        INSERT INTO transactions VALUES
            (1, 'tx-1', NULL, 1787425493, 1787425493, -100, 10, 1, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (2, 'tx-2', NULL, 1787425493, 1787425493, 40, 13, 1, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (3, 'tx-3', NULL, 1787425493, 1787425493, -30, 13, 1, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (4, 'tx-4', NULL, 1787425493, 1787425493, 50, 12, 1, NULL, NULL, NULL, NULL, NULL, 0, 'RECONCILED', NULL, NULL, NULL, NULL),
            (5, 'tx-void', NULL, 1787425493, 0, 999, 11, 1, NULL, NULL, NULL, NULL, NULL, 0, 'VOID', NULL, NULL, NULL, NULL),
            (6, 'split-parent', 'Parent comment', 1787425493, 1787425493, 300, 0, 1, 2, NULL, NULL, 2, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (7, 'split-child-1', 'Child comment', 1787425493, 0, 100, 11, 1, 1, NULL, NULL, 1, 6, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (8, 'split-child-2', NULL, 1787425493, 39600, 200, 10, 1, NULL, NULL, NULL, NULL, 6, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (9, 'archive-wrapper', NULL, 1787425493, 1787425493, 77, NULL, 1, NULL, NULL, NULL, NULL, NULL, 4, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (10, 'archive-content', NULL, 1787425493, 1787425493, 77, 11, 1, NULL, NULL, NULL, NULL, 9, 5, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (11, 'debt-expense', NULL, 1787425493, 1787425493, -25, 10, 2, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (12, 'static-fx', NULL, 1787425493, 1787425493, 10, 11, 3, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, '___', NULL),
            (13, 'dynamic-fx', NULL, 1787425493, 1787425493, 10, 11, 4, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (14, 'dynamic-parent', NULL, 1787425493, 1787425493, 100, 0, 4, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (15, 'dynamic-child', NULL, 1787425493, 1787425493, 40, 11, 4, NULL, NULL, NULL, NULL, 14, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
            (16, 'mismatched-child-type', NULL, 1787425493, 1787425493, 0, 14, 1, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL);

        INSERT INTO equivalent_amounts VALUES
            (12, 'EUR', 999),
            (13, 'EUR', 30),
            (14, 'EUR', 250);
        INSERT INTO transactions_tags VALUES
            (6, 2),
            (7, 1);
        INSERT INTO budgets VALUES
            (1, 'budget-1', 'Monthly', '', 'MONTH', 1, '___', NULL, NULL, 1);
        INSERT INTO budget_allocations VALUES
            (1, 0, NULL, NULL, 500, 0, 0, 0),
            (1, 10, 2026, 8, 100, 5, 7, 1);
    `);
    return database;
}

test("validates the exact schema version before inspecting data", () => {
    const database = new SQL.Database();
    try {
        database.run("PRAGMA user_version = 188");
        assert.throws(
            () => validateV189Database(database),
            (error: unknown) =>
                error instanceof V189SchemaError &&
                error.message.includes("expected 189, received 188"),
        );
    } finally {
        database.close();
    }
});

test("normalizes v189 postings, FX, lookups, budgets and scope partitions", () => {
    const database = fixtureDatabase();
    try {
        const dataset = adaptV189(database, {
            timeZone: "Europe/Madrid",
            preferences: {
                homeCurrency: "EUR",
                monthStart: 1,
                weekStart: 2,
                unmappedTransactionsAsTransfers: false,
                dynamicExchangeRatesMode: "PER_ACCOUNT",
            },
        });

        assert.equal(dataset.metadata.schemaVersion, 189);
        assert.deepEqual(
            dataset.currencies.map((currency) => currency.code),
            ["EUR", "USD"],
        );
        assert.equal(dataset.postings.length, 13);
        assert.equal(dataset.postings.some((posting) => posting.id === 6), false);
        assert.equal(dataset.postings.some((posting) => posting.id === 9), false);
        assert.equal(dataset.postings.find((posting) => posting.id === 10)?.isArchivedContent, true);

        const positiveNeutral = dataset.postings.find((posting) => posting.id === 2);
        const negativeNeutral = dataset.postings.find((posting) => posting.id === 3);
        assert.equal(positiveNeutral?.categoryType, CATEGORY_TYPE.NEUTRAL);
        assert.equal(positiveNeutral?.bucket, "INCOME");
        assert.equal(negativeNeutral?.bucket, "EXPENSE");
        assert.equal(dataset.postings.find((posting) => posting.id === 4)?.bucket, "TRANSFER");

        const mismatchedCategory = dataset.categories.find(
            (category) => category.id === 14,
        );
        const inheritedTypePosting = dataset.postings.find(
            (posting) => posting.id === 16,
        );
        assert.deepEqual(mismatchedCategory?.path, ["Expense", "Mismatched child"]);
        assert.equal(mismatchedCategory?.nativeType, CATEGORY_TYPE.INCOME);
        assert.equal(mismatchedCategory?.type, CATEGORY_TYPE.EXPENSE);
        assert.equal(inheritedTypePosting?.nativeCategoryType, CATEGORY_TYPE.INCOME);
        assert.equal(inheritedTypePosting?.categoryType, CATEGORY_TYPE.EXPENSE);
        assert.equal(inheritedTypePosting?.bucket, "EXPENSE");

        const voidPosting = dataset.postings.find((posting) => posting.id === 5);
        assert.equal(voidPosting?.isVoid, true);
        assert.equal(voidPosting?.valueDate, null);
        assert.equal(voidPosting?.amountHomeMinor, 999);

        const split = dataset.postings.find((posting) => posting.id === 7);
        assert.equal(split?.isSplitPart, true);
        assert.equal(split?.splitIndex, 0);
        assert.equal(split?.splitCount, 2);
        assert.equal(split?.parentUuid, "split-parent");
        assert.equal(split?.parentAmountMinor, 300);
        assert.equal(split?.parentComment, "Parent comment");
        assert.equal(split?.rawValueDateEpochSeconds, 0);
        assert.equal(split?.rawValueDate, null);
        assert.equal(split?.parentValueDate?.localDateTime, "2026-08-22T21:04:53");
        assert.equal(split?.valueDate?.localDateTime, "2026-08-22T21:04:53");
        assert.deepEqual(split?.effectivePayeeIds, [1, 2]);
        assert.deepEqual(split?.effectiveMethodIds, [1, 2]);
        assert.deepEqual(split?.effectiveTagIds, [1, 2]);
        const splitWithSentinel = dataset.postings.find(
            (posting) => posting.id === 8,
        );
        assert.equal(splitWithSentinel?.rawValueDateEpochSeconds, 39_600);
        assert.equal(splitWithSentinel?.rawValueDate, null);
        assert.equal(
            splitWithSentinel?.valueDate?.localDateTime,
            "2026-08-22T21:04:53",
        );

        const staticFx = dataset.postings.find((posting) => posting.id === 12);
        const dynamicFx = dataset.postings.find((posting) => posting.id === 13);
        const dynamicSplit = dataset.postings.find((posting) => posting.id === 15);
        assert.equal(staticFx?.amountHomeMinor, 20);
        assert.equal(staticFx?.fxSource, "STATIC_ACCOUNT_RATE");
        assert.equal(staticFx?.originalCurrency, null);
        assert.equal(dynamicFx?.amountHomeMinor, 30);
        assert.equal(dynamicFx?.fxSource, "DYNAMIC_EQUIVALENT");
        assert.equal(dynamicSplit?.amountHomeMinor, 100);
        assert.equal(dynamicSplit?.fxSource, "DYNAMIC_SPLIT_PRORATION");

        assert.equal(dataset.postings[0]?.date.localDateTime, "2026-08-22T21:04:53");
        assert.equal(dataset.paymentMethods[0]?.type, -1);
        assert.equal(dataset.budgets[0]?.allocations.length, 2);
        assert.equal(dataset.budgets[0]?.currency, null);

        assert.deepEqual(
            {
                opening: dataset.scopes.ALL.openingBalanceHomeMinor,
                income: dataset.scopes.ALL.incomesHomeMinor,
                expense: dataset.scopes.ALL.expensesHomeMinor,
                transfer: dataset.scopes.ALL.transfersHomeMinor,
                movement: dataset.scopes.ALL.movementHomeMinor,
                historical: dataset.scopes.ALL.closingFlowBalanceHomeMinor,
                valuation: dataset.scopes.ALL.valuationBalanceHomeMinor,
            },
            {
                opening: 300,
                income: 367,
                expense: 45,
                transfer: 50,
                movement: 462,
                historical: 762,
                valuation: 732,
            },
        );
        assert.equal(dataset.scopes.DEBT.openingBalanceHomeMinor, 200);
        assert.equal(dataset.scopes.DEBT.movementHomeMinor, -25);
        assert.equal(
            dataset.scopes.ALL.movementHomeMinor,
            dataset.scopes.DEBT.movementHomeMinor +
                dataset.scopes.REAL_CASH.movementHomeMinor,
        );
        assert.equal(
            dataset.scopes.ALL.valuationBalanceHomeMinor,
            dataset.scopes.DEBT.valuationBalanceHomeMinor +
                dataset.scopes.REAL_CASH.valuationBalanceHomeMinor,
        );
    } finally {
        database.close();
    }
});

test("rejects a non-zero foreign posting without a usable conversion", () => {
    const database = fixtureDatabase();
    try {
        database.run("DELETE FROM account_exchangerates WHERE account_id = 3");
        assert.throws(
            () =>
                adaptV189(database, {
                    timeZone: "Europe/Madrid",
                    preferences: {
                        homeCurrency: "EUR",
                        dynamicExchangeRatesMode: "PER_ACCOUNT",
                    },
                }),
            /Foreign transaction 12 has no dynamic equivalent or account exchange rate/,
        );
    } finally {
        database.close();
    }
});
