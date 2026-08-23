import type initSqlJs from "sql.js";

import {
    CATEGORY_TYPE,
    V189_SCHEMA_VERSION,
    type MinorUnits,
    type V189Account,
    type V189AdapterOptions,
    type V189Budget,
    type V189BudgetAllocation,
    type V189CanonicalDataset,
    type V189Category,
    type V189CategoryType,
    type V189Currency,
    type V189DynamicExchangeRatesMode,
    type V189FxSource,
    type V189LocalTimestamp,
    type V189Payee,
    type V189PaymentMethod,
    type V189Posting,
    type V189PostingBucket,
    type V189Preferences,
    type V189ReconciliationStatus,
    type V189Scope,
    type V189ScopeName,
    type V189Tag,
} from "./models.ts";
import { validateV189Database } from "./schema.ts";

type SqlRow = Record<string, initSqlJs.SqlValue>;

interface CategoryDraft {
    id: number;
    uuid: string | null;
    parentId: number | null;
    label: string;
    nativeType: V189CategoryType;
    color: number | null;
    icon: string | null;
}

interface NormalizedOptions {
    timeZone: string;
    preferences: V189Preferences;
    includeExcludedAccounts: boolean;
}

interface ResolvedCategory {
    path: readonly string[];
    type: V189CategoryType;
}

const RECONCILIATION_STATUSES = new Set<V189ReconciliationStatus>([
    "UNRECONCILED",
    "CLEARED",
    "RECONCILED",
    "VOID",
]);

function queryRows(
    database: initSqlJs.Database,
    sql: string,
    parameters: initSqlJs.BindParams = null,
): SqlRow[] {
    const statement = database.prepare(sql, parameters);
    try {
        const rows: SqlRow[] = [];
        while (statement.step()) {
            rows.push(statement.getAsObject());
        }
        return rows;
    } finally {
        statement.free();
    }
}

function value(row: SqlRow, column: string): initSqlJs.SqlValue {
    if (!Object.hasOwn(row, column)) {
        throw new Error(`SQL result is missing column ${column}`);
    }
    return row[column] ?? null;
}

function requiredString(row: SqlRow, column: string): string {
    const result = value(row, column);
    if (typeof result !== "string") {
        throw new Error(`Expected ${column} to be a non-null string`);
    }
    return result;
}

function optionalString(row: SqlRow, column: string): string | null {
    const result = value(row, column);
    if (result === null) {
        return null;
    }
    if (typeof result !== "string") {
        throw new Error(`Expected ${column} to be a string or null`);
    }
    return result;
}

function optionalCurrency(row: SqlRow, column: string): string | null {
    const result = optionalString(row, column);
    return result === "___" ? null : result;
}

function requiredNumber(row: SqlRow, column: string): number {
    const result = value(row, column);
    if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error(`Expected ${column} to be a finite number`);
    }
    return result;
}

function optionalNumber(row: SqlRow, column: string): number | null {
    const result = value(row, column);
    if (result === null) {
        return null;
    }
    if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error(`Expected ${column} to be a finite number or null`);
    }
    return result;
}

function requiredInteger(row: SqlRow, column: string): number {
    return asSafeInteger(requiredNumber(row, column), column);
}

function optionalInteger(row: SqlRow, column: string): number | null {
    const result = optionalNumber(row, column);
    return result === null ? null : asSafeInteger(result, column);
}

function asSafeInteger(input: number, context: string): number {
    if (!Number.isSafeInteger(input)) {
        throw new Error(`${context} must be a safe integer`);
    }
    return input === 0 ? 0 : input;
}

function asMinorUnits(input: number, context: string): MinorUnits {
    return asSafeInteger(input, context);
}

function asBoolean(input: number, context: string): boolean {
    if (input !== 0 && input !== 1) {
        throw new Error(`${context} must be SQLite boolean 0 or 1`);
    }
    return input === 1;
}

function safeAdd(left: number, right: number, context: string): number {
    return asSafeInteger(left + right, context);
}

/** SQLite round() rounds halves away from zero; Math.round() does not for negatives. */
function sqliteRound(input: number, context: string): number {
    if (!Number.isFinite(input)) {
        throw new Error(`${context} produced a non-finite amount`);
    }
    return asSafeInteger(
        Math.sign(input) * Math.round(Math.abs(input)),
        context,
    );
}

function validateCategoryType(
    input: number,
    context: string,
): V189CategoryType {
    if (
        input !== CATEGORY_TYPE.TRANSFER &&
        input !== CATEGORY_TYPE.EXPENSE &&
        input !== CATEGORY_TYPE.INCOME &&
        input !== CATEGORY_TYPE.NEUTRAL
    ) {
        throw new Error(`${context} has unsupported category type ${input}`);
    }
    return input;
}

function validateDynamicMode(
    input: V189DynamicExchangeRatesMode | undefined,
): V189DynamicExchangeRatesMode {
    const result = input ?? "PER_ACCOUNT";
    if (
        result !== "PER_ACCOUNT" &&
        result !== "ALL_DYNAMIC" &&
        result !== "ALL_STATIC"
    ) {
        throw new Error(`Unsupported dynamic exchange-rate mode: ${String(result)}`);
    }
    return result;
}

function normalizeOptions(options: V189AdapterOptions): NormalizedOptions {
    const homeCurrency = options.preferences.homeCurrency.trim();
    if (homeCurrency.length === 0) {
        throw new Error("homeCurrency must not be empty");
    }

    try {
        new Intl.DateTimeFormat("en-CA", {
            timeZone: options.timeZone,
        }).format(new Date(0));
    } catch (error) {
        throw new Error(`Invalid IANA time zone: ${options.timeZone}`, {
            cause: error,
        });
    }

    const monthStart = options.preferences.monthStart ?? 1;
    if (!Number.isInteger(monthStart) || monthStart < 1 || monthStart > 31) {
        throw new Error("monthStart must be an integer from 1 through 31");
    }
    // java.util.Calendar uses Sunday=1 through Saturday=7. Europe/Madrid defaults to Monday=2.
    const weekStart = options.preferences.weekStart ?? 2;
    if (!Number.isInteger(weekStart) || weekStart < 1 || weekStart > 7) {
        throw new Error("weekStart must be an integer from 1 through 7");
    }

    return {
        timeZone: options.timeZone,
        includeExcludedAccounts: options.includeExcludedAccounts ?? false,
        preferences: {
            homeCurrency,
            monthStart,
            weekStart,
            aggregateNeutral: options.preferences.aggregateNeutral ?? false,
            includeTransfers: options.preferences.includeTransfers ?? false,
            unmappedTransactionsAsTransfers:
                options.preferences.unmappedTransactionsAsTransfers ?? false,
            dynamicExchangeRatesMode: validateDynamicMode(
                options.preferences.dynamicExchangeRatesMode,
            ),
        },
    };
}

function timestampFormatter(timeZone: string): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        calendar: "gregory",
        numberingSystem: "latn",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    });
}

function localTimestamp(
    epochSeconds: number,
    formatter: Intl.DateTimeFormat,
): V189LocalTimestamp {
    asSafeInteger(epochSeconds, "transaction epoch seconds");
    const instant = new Date(epochSeconds * 1_000);
    if (Number.isNaN(instant.getTime())) {
        throw new Error(`Invalid transaction epoch: ${epochSeconds}`);
    }
    const parts = new Map(
        formatter
            .formatToParts(instant)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]),
    );
    const year = parts.get("year");
    const month = parts.get("month");
    const day = parts.get("day");
    const hour = parts.get("hour");
    const minute = parts.get("minute");
    const second = parts.get("second");
    if (
        year === undefined ||
        month === undefined ||
        day === undefined ||
        hour === undefined ||
        minute === undefined ||
        second === undefined
    ) {
        throw new Error("Could not derive local transaction date and time");
    }
    const localDate = `${year}-${month}-${day}`;
    const localTime = `${hour}:${minute}:${second}`;
    return {
        epochSeconds,
        localDate,
        localTime,
        localDateTime: `${localDate}T${localTime}`,
    };
}

function valueDateTimestamp(
    epochSeconds: number,
    formatter: Intl.DateTimeFormat,
): V189LocalTimestamp | null {
    return epochSeconds === 0 || epochSeconds === 39_600
        ? null
        : localTimestamp(epochSeconds, formatter);
}

function effectiveDynamic(
    storedValue: boolean,
    currency: string,
    preferences: V189Preferences,
): boolean {
    if (currency === preferences.homeCurrency) {
        return false;
    }
    switch (preferences.dynamicExchangeRatesMode) {
        case "ALL_DYNAMIC":
            return true;
        case "ALL_STATIC":
            return false;
        case "PER_ACCOUNT":
            return storedValue;
    }
}

function loadCurrencies(
    database: initSqlJs.Database,
    homeCurrency: string,
): V189Currency[] {
    return queryRows(
        database,
        `SELECT _id, code, label, fraction_digits, symbol, commodity_type
         FROM currency
         WHERE code = ?
            OR code IN (SELECT currency FROM accounts)
            OR code IN (
                SELECT currency FROM budgets
                WHERE currency IS NOT NULL AND currency != '___'
            )
            OR code IN (
                SELECT original_currency FROM transactions
                WHERE original_currency IS NOT NULL AND original_currency != '___'
            )
            OR code IN (SELECT currency FROM equivalent_amounts)
         ORDER BY _id`,
        [homeCurrency],
    ).map((row) => {
        const code = requiredString(row, "code");
        const fractionDigits = optionalInteger(row, "fraction_digits");
        if (
            fractionDigits === null ||
            fractionDigits < 0 ||
            fractionDigits > 18
        ) {
            throw new Error(
                `Used currency ${code} must define fraction_digits from 0 through 18`,
            );
        }
        return {
            id: requiredInteger(row, "_id"),
            code,
            label: optionalString(row, "label"),
            fractionDigits,
            symbol: optionalString(row, "symbol"),
            commodityType: optionalString(row, "commodity_type"),
        };
    });
}

function referencedCurrencyCodes(
    database: initSqlJs.Database,
    homeCurrency: string,
): Set<string> {
    return new Set(
        queryRows(
            database,
            `SELECT ? AS code
             UNION SELECT currency FROM accounts
             UNION SELECT currency FROM budgets
                    WHERE currency IS NOT NULL AND currency != '___'
             UNION SELECT original_currency FROM transactions
                    WHERE original_currency IS NOT NULL AND original_currency != '___'
             UNION SELECT currency FROM equivalent_amounts`,
            [homeCurrency],
        ).map((row) => requiredString(row, "code")),
    );
}

function loadAccounts(
    database: initSqlJs.Database,
    options: NormalizedOptions,
): V189Account[] {
    const rows = queryRows(
        database,
        `SELECT
            a._id,
            a.uuid,
            a.label,
            a.description,
            a.currency,
            a.type AS type_id,
            account_types.label AS type_label,
            account_types.isAsset AS is_asset,
            account_types.supportsReconciliation AS supports_reconciliation,
            a.flag AS flag_id,
            account_flags.visible,
            a.opening_balance,
            a.exclude_from_totals,
            a.dynamic,
            a.parent_id,
            rates.exchange_rate,
            (SELECT p.value
               FROM prices p
              WHERE p.commodity = a.currency
                AND p.currency = ?
              ORDER BY p.date DESC,
                       CASE
                         WHEN p.source = 'user' THEN 1
                         WHEN p.source = 'calculation' THEN 3
                         ELSE 2
                       END,
                       p.source DESC
              LIMIT 1) AS latest_exchange_rate
         FROM accounts a
         JOIN account_types ON account_types._id = a.type
         JOIN account_flags ON account_flags._id = a.flag
         LEFT JOIN account_exchangerates rates
           ON rates.account_id = a._id
          AND rates.currency_self = a.currency
          AND rates.currency_other = ?
         ORDER BY a._id`,
        [options.preferences.homeCurrency, options.preferences.homeCurrency],
    );

    return rows.map((row) => {
        const id = requiredInteger(row, "_id");
        const currency = requiredString(row, "currency");
        const openingBalanceMinor = asMinorUnits(
            optionalInteger(row, "opening_balance") ?? 0,
            `account ${id} opening balance`,
        );
        const storedDynamic = asBoolean(requiredInteger(row, "dynamic"), "dynamic");
        const exchangeRate = optionalNumber(row, "exchange_rate");
        if (exchangeRate !== null && exchangeRate <= 0) {
            throw new Error(`Account ${id} has an invalid exchange rate`);
        }
        const excludedFromTotals = asBoolean(
            requiredInteger(row, "exclude_from_totals"),
            "exclude_from_totals",
        );
        const parentId = optionalInteger(row, "parent_id");
        const dynamicExchangeRates = effectiveDynamic(
            storedDynamic,
            currency,
            options.preferences,
        );
        const latestExchangeRate = optionalNumber(row, "latest_exchange_rate");
        if (latestExchangeRate !== null && latestExchangeRate <= 0) {
            throw new Error(`Account ${id} has an invalid latest exchange rate`);
        }
        const rateForOpening =
            currency === options.preferences.homeCurrency
                ? 1
                : exchangeRate;
        if (rateForOpening === null && openingBalanceMinor !== 0) {
            throw new Error(
                `Foreign account ${id} has a non-zero opening balance but no exchange rate`,
            );
        }
        const valuationRate =
            currency === options.preferences.homeCurrency
                ? 1
                : dynamicExchangeRates
                  ? (latestExchangeRate ?? exchangeRate)
                  : exchangeRate;
        const typeId = requiredInteger(row, "type_id");
        const uuid = optionalString(row, "uuid")?.trim();
        if (uuid === undefined || uuid === null || uuid.length === 0) {
            throw new Error(`Account ${id} must define a non-empty UUID`);
        }
        const openingBalanceHomeMinor = sqliteRound(
            openingBalanceMinor * (rateForOpening ?? 0),
            `account ${id} equivalent opening balance`,
        );
        return {
            id,
            uuid,
            label: requiredString(row, "label"),
            description: optionalString(row, "description"),
            currency,
            typeId,
            typeLabel: requiredString(row, "type_label"),
            isAsset: asBoolean(requiredInteger(row, "is_asset"), "isAsset"),
            isLiability: typeId === 5,
            supportsReconciliation: asBoolean(
                requiredInteger(row, "supports_reconciliation"),
                "supportsReconciliation",
            ),
            flagId: requiredInteger(row, "flag_id"),
            visible: asBoolean(requiredInteger(row, "visible"), "visible"),
            excludedFromTotals,
            includedInAll:
                parentId === null &&
                (options.includeExcludedAccounts || !excludedFromTotals),
            dynamicExchangeRates,
            parentId,
            openingBalanceMinor,
            openingBalanceHomeMinor,
            exchangeRateToHome:
                currency === options.preferences.homeCurrency ? 1 : exchangeRate,
            valuationRateToHome: valuationRate,
            nativeClosingBalanceMinor: openingBalanceMinor,
            historicalClosingBalanceHomeMinor: openingBalanceHomeMinor,
            valuationBalanceHomeMinor: openingBalanceHomeMinor,
        };
    });
}

function loadCategories(database: initSqlJs.Database): V189Category[] {
    const drafts = queryRows(
        database,
        `SELECT _id, uuid, parent_id, label, type, color, icon
         FROM categories WHERE _id != 0 ORDER BY _id`,
    ).map<CategoryDraft>((row) => {
        const id = requiredInteger(row, "_id");
        return {
            id,
            uuid: optionalString(row, "uuid"),
            parentId: optionalInteger(row, "parent_id"),
            label: requiredString(row, "label"),
            nativeType: validateCategoryType(
                requiredInteger(row, "type"),
                `category ${id}`,
            ),
            color: optionalInteger(row, "color"),
            icon: optionalString(row, "icon"),
        };
    });
    const byId = new Map(drafts.map((category) => [category.id, category]));
    const resolved = new Map<number, ResolvedCategory>();
    const active = new Set<number>();

    const resolveCategory = (category: CategoryDraft): ResolvedCategory => {
        const cached = resolved.get(category.id);
        if (cached !== undefined) {
            return cached;
        }
        if (active.has(category.id)) {
            throw new Error(`Category hierarchy contains a cycle at ${category.id}`);
        }
        active.add(category.id);
        const parent =
            category.parentId === null
                ? null
                : (byId.get(category.parentId) ??
                  (() => {
                      throw new Error(
                          `Category ${category.id} references missing parent ${category.parentId}`,
                      );
                  })());
        const parentResolved = parent === null ? null : resolveCategory(parent);
        const result: ResolvedCategory = {
            path:
                parentResolved === null
                    ? [category.label]
                    : [...parentResolved.path, category.label],
            type: parentResolved?.type ?? category.nativeType,
        };
        active.delete(category.id);
        resolved.set(category.id, result);
        return result;
    };

    return drafts.map((category) => {
        const resolution = resolveCategory(category);
        return {
            id: category.id,
            uuid: category.uuid,
            parentId: category.parentId,
            label: category.label,
            path: resolution.path,
            nativeType: category.nativeType,
            type: resolution.type,
            color: category.color,
            icon: category.icon,
        };
    });
}

function loadPayees(database: initSqlJs.Database): V189Payee[] {
    return queryRows(
        database,
        "SELECT _id, name, short_name, parent_id FROM payee ORDER BY _id",
    ).map((row) => ({
        id: requiredInteger(row, "_id"),
        name: requiredString(row, "name"),
        shortName: optionalString(row, "short_name"),
        parentId: optionalInteger(row, "parent_id"),
    }));
}

function loadPaymentMethods(database: initSqlJs.Database): V189PaymentMethod[] {
    return queryRows(
        database,
        "SELECT _id, label, is_numbered, type, icon FROM paymentmethods ORDER BY _id",
    ).map((row) => ({
        id: requiredInteger(row, "_id"),
        label: requiredString(row, "label"),
        type: optionalInteger(row, "type"),
        isNumbered: asBoolean(
            optionalInteger(row, "is_numbered") ?? 0,
            "is_numbered",
        ),
        icon: optionalString(row, "icon"),
    }));
}

function loadTags(database: initSqlJs.Database): V189Tag[] {
    return queryRows(
        database,
        "SELECT _id, label, color FROM tags ORDER BY _id",
    ).map((row) => ({
        id: requiredInteger(row, "_id"),
        label: requiredString(row, "label"),
        color: optionalInteger(row, "color"),
    }));
}

function loadTagMap(database: initSqlJs.Database): Map<number, readonly number[]> {
    const result = new Map<number, number[]>();
    for (const row of queryRows(
        database,
        `SELECT transaction_id, tag_id
         FROM transactions_tags ORDER BY transaction_id, tag_id`,
    )) {
        const transactionId = requiredInteger(row, "transaction_id");
        const tagId = requiredInteger(row, "tag_id");
        const current = result.get(transactionId) ?? [];
        if (!current.includes(tagId)) {
            current.push(tagId);
        }
        result.set(transactionId, current);
    }
    return result;
}

function loadBudgets(database: initSqlJs.Database): V189Budget[] {
    const allocations = new Map<number, V189BudgetAllocation[]>();
    for (const row of queryRows(
        database,
        `SELECT budget_id, cat_id, year, second, budget,
                rollOverPrevious, rollOverNext, oneTime
         FROM budget_allocations ORDER BY budget_id, cat_id, year, second`,
    )) {
        const budgetId = requiredInteger(row, "budget_id");
        const allocation: V189BudgetAllocation = {
            categoryId: requiredInteger(row, "cat_id"),
            year: optionalInteger(row, "year"),
            second: optionalInteger(row, "second"),
            budgetMinor: optionalInteger(row, "budget"),
            rolloverPreviousMinor: asMinorUnits(
                optionalInteger(row, "rollOverPrevious") ?? 0,
                `budget ${budgetId} previous rollover`,
            ),
            rolloverNextMinor: asMinorUnits(
                optionalInteger(row, "rollOverNext") ?? 0,
                `budget ${budgetId} next rollover`,
            ),
            oneTime: asBoolean(
                optionalInteger(row, "oneTime") ?? 0,
                "oneTime",
            ),
        };
        const current = allocations.get(budgetId) ?? [];
        current.push(allocation);
        allocations.set(budgetId, current);
    }

    return queryRows(
        database,
        `SELECT _id, uuid, title, description, grouping, account_id,
                currency, start, end, is_default
         FROM budgets ORDER BY _id`,
    ).map((row) => {
        const id = requiredInteger(row, "_id");
        const start = value(row, "start");
        const end = value(row, "end");
        if (
            (start !== null && typeof start !== "string" && typeof start !== "number") ||
            (end !== null && typeof end !== "string" && typeof end !== "number")
        ) {
            throw new Error(`Budget ${id} contains invalid date boundaries`);
        }
        return {
            id,
            uuid: optionalString(row, "uuid"),
            title: requiredString(row, "title"),
            description: requiredString(row, "description"),
            grouping: requiredString(row, "grouping"),
            accountId: optionalInteger(row, "account_id"),
            currency: optionalCurrency(row, "currency"),
            start,
            end,
            isDefault: asBoolean(requiredInteger(row, "is_default"), "is_default"),
            allocations: allocations.get(id) ?? [],
        };
    });
}

function effectiveIds(...ids: Array<number | null>): readonly number[] {
    return [...new Set(ids.filter((id): id is number => id !== null))];
}

function effectiveTags(
    child: readonly number[],
    parent: readonly number[],
): readonly number[] {
    return [...new Set([...child, ...parent])];
}

function postingBucket(
    type: V189CategoryType,
    amountMinor: number,
): { effectiveType: V189CategoryType; bucket: V189PostingBucket } {
    if (type === CATEGORY_TYPE.EXPENSE) {
        return { effectiveType: type, bucket: "EXPENSE" };
    }
    if (type === CATEGORY_TYPE.INCOME) {
        return { effectiveType: type, bucket: "INCOME" };
    }
    if (type === CATEGORY_TYPE.TRANSFER) {
        return { effectiveType: type, bucket: "TRANSFER" };
    }
    // r871 maps zero-valued neutral postings to expenses (CASE > 0 ELSE expense).
    return amountMinor > 0
        ? { effectiveType: CATEGORY_TYPE.INCOME, bucket: "INCOME" }
        : { effectiveType: CATEGORY_TYPE.EXPENSE, bucket: "EXPENSE" };
}

function convertedAmount(
    row: SqlRow,
    account: V189Account,
    amountMinor: MinorUnits,
    homeCurrency: string,
): {
    amountHomeMinor: MinorUnits;
    fxRateToHome: number | null;
    fxSource: V189FxSource;
} {
    if (account.currency === homeCurrency) {
        return {
            amountHomeMinor: amountMinor,
            fxRateToHome: 1,
            fxSource: "HOME_CURRENCY",
        };
    }

    const parentId = optionalInteger(row, "parent_id");
    if (account.dynamicExchangeRates) {
        if (parentId !== null) {
            const parentAmount = optionalInteger(row, "parent_amount");
            const parentEquivalent = optionalInteger(row, "parent_equivalent_amount");
            if (
                parentAmount !== null &&
                parentAmount !== 0 &&
                parentEquivalent !== null
            ) {
                const rate = parentEquivalent / parentAmount;
                return {
                    amountHomeMinor: sqliteRound(
                        rate * amountMinor,
                        `transaction ${requiredInteger(row, "_id")} split conversion`,
                    ),
                    fxRateToHome: rate,
                    fxSource: "DYNAMIC_SPLIT_PRORATION",
                };
            }
        } else {
            const equivalent = optionalInteger(row, "equivalent_amount");
            if (equivalent !== null) {
                return {
                    amountHomeMinor: equivalent,
                    fxRateToHome:
                        amountMinor === 0
                            ? (account.exchangeRateToHome ?? 1)
                            : equivalent / amountMinor,
                    fxSource: "DYNAMIC_EQUIVALENT",
                };
            }
        }
    }

    const exchangeRate = account.exchangeRateToHome;
    if (exchangeRate === null) {
        if (amountMinor === 0) {
            return {
                amountHomeMinor: 0,
                fxRateToHome: null,
                fxSource: "ZERO_AMOUNT_WITHOUT_RATE",
            };
        }
        throw new Error(
            `Foreign transaction ${requiredInteger(row, "_id")} has no dynamic equivalent or account exchange rate`,
        );
    }
    const rate = exchangeRate;
    return {
        amountHomeMinor: sqliteRound(
            rate * amountMinor,
            `transaction ${requiredInteger(row, "_id")} static conversion`,
        ),
        fxRateToHome: rate,
        fxSource: "STATIC_ACCOUNT_RATE",
    };
}

function loadPostings(
    database: initSqlJs.Database,
    accounts: readonly V189Account[],
    categories: readonly V189Category[],
    tagMap: ReadonlyMap<number, readonly number[]>,
    options: NormalizedOptions,
): V189Posting[] {
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const categoryById = new Map(
        categories.map((category) => [category.id, category]),
    );
    const formatter = timestampFormatter(options.timeZone);
    const rows = queryRows(
        database,
        `SELECT
            t._id,
            t.uuid,
            t.parent_id,
            t.status,
            t.cr_status,
            t.account_id,
            t.date,
            t.value_date,
            t.amount,
            t.cat_id,
            t.transfer_peer,
            t.transfer_account,
            t.debt_id,
            t.payee_id,
            t.method_id,
            t.comment,
            t.number,
            t.original_amount,
            t.original_currency,
            parent.cat_id AS parent_cat_id,
            parent.uuid AS parent_uuid,
            parent.date AS parent_date,
            parent.value_date AS parent_value_date,
            parent.amount AS parent_amount,
            parent.payee_id AS parent_payee_id,
            parent.method_id AS parent_method_id,
            parent.comment AS parent_comment,
            (SELECT count(*)
               FROM transactions siblings
              WHERE siblings.parent_id = t.parent_id) AS sibling_count,
            (SELECT count(*)
               FROM transactions earlier_siblings
              WHERE earlier_siblings.parent_id = t.parent_id
                AND earlier_siblings._id < t._id) AS sibling_index,
            own_equivalent.equivalent_amount,
            parent_equivalent.equivalent_amount AS parent_equivalent_amount
         FROM transactions t
         JOIN accounts a ON a._id = t.account_id
         LEFT JOIN transactions parent ON parent._id = t.parent_id
         LEFT JOIN equivalent_amounts own_equivalent
           ON own_equivalent.transaction_id = t._id
          AND own_equivalent.currency = ?
         LEFT JOIN equivalent_amounts parent_equivalent
           ON parent_equivalent.transaction_id = parent._id
          AND parent_equivalent.currency = ?
         WHERE t.status != 2
           AND t.status != 4
           AND t.cat_id IS NOT 0
         ORDER BY t._id`,
        [options.preferences.homeCurrency, options.preferences.homeCurrency],
    );

    return rows.flatMap((row): V189Posting[] => {
        const id = requiredInteger(row, "_id");
        const accountId = requiredInteger(row, "account_id");
        const account = accountById.get(accountId);
        if (account === undefined) {
            throw new Error(`Transaction ${id} references missing account ${accountId}`);
        }
        if (!account.includedInAll) {
            return [];
        }
        const amountMinor = asMinorUnits(
            requiredInteger(row, "amount"),
            `transaction ${id} amount`,
        );
        const categoryId = optionalInteger(row, "cat_id");
        const category =
            categoryId === null ? undefined : categoryById.get(categoryId);
        if (categoryId !== null && category === undefined) {
            throw new Error(`Transaction ${id} references missing category ${categoryId}`);
        }
        const categoryType =
            category?.type ??
            (options.preferences.unmappedTransactionsAsTransfers
                ? CATEGORY_TYPE.TRANSFER
                : CATEGORY_TYPE.NEUTRAL);
        const { effectiveType, bucket } = postingBucket(
            categoryType,
            amountMinor,
        );
        const reconciliationStatus = requiredString(
            row,
            "cr_status",
        ) as V189ReconciliationStatus;
        if (!RECONCILIATION_STATUSES.has(reconciliationStatus)) {
            throw new Error(
                `Transaction ${id} has invalid cr_status ${reconciliationStatus}`,
            );
        }
        const sourceStatusCode = requiredInteger(row, "status");
        const parentTransactionId = optionalInteger(row, "parent_id");
        const parentCategoryId = optionalInteger(row, "parent_cat_id");
        const isSplitPart = parentCategoryId === 0;
        const rawValueDateEpochSeconds = requiredInteger(row, "value_date");
        const parentValueDateEpochSeconds = optionalInteger(
            row,
            "parent_value_date",
        );
        let effectiveValueDateEpochSeconds: number;
        if (isSplitPart) {
            if (parentValueDateEpochSeconds === null) {
                throw new Error(
                    `Split transaction ${id} is missing its parent value date`,
                );
            }
            effectiveValueDateEpochSeconds = parentValueDateEpochSeconds;
        } else {
            effectiveValueDateEpochSeconds = rawValueDateEpochSeconds;
        }
        const tagIds = tagMap.get(id) ?? [];
        const parentTagIds =
            parentTransactionId === null
                ? []
                : (tagMap.get(parentTransactionId) ?? []);
        const payeeId = optionalInteger(row, "payee_id");
        const parentPayeeId = optionalInteger(row, "parent_payee_id");
        const methodId = optionalInteger(row, "method_id");
        const parentMethodId = optionalInteger(row, "parent_method_id");
        return [
            {
                id,
                uuid: optionalString(row, "uuid"),
                parentTransactionId,
                parentUuid: optionalString(row, "parent_uuid"),
                parentDate:
                    parentTransactionId === null
                        ? null
                        : localTimestamp(
                              requiredInteger(row, "parent_date"),
                              formatter,
                          ),
                parentValueDate:
                    parentValueDateEpochSeconds === null
                        ? null
                        : valueDateTimestamp(
                              parentValueDateEpochSeconds,
                              formatter,
                          ),
                parentAmountMinor:
                    parentTransactionId === null
                        ? null
                        : optionalInteger(row, "parent_amount"),
                isSplitPart,
                splitIndex:
                    isSplitPart ? requiredInteger(row, "sibling_index") : null,
                splitCount:
                    isSplitPart ? requiredInteger(row, "sibling_count") : null,
                sourceStatusCode,
                isArchivedContent: sourceStatusCode === 5,
                accountId,
                accountCurrency: account.currency,
                leafScope: account.isLiability ? "DEBT" : "REAL_CASH",
                date: localTimestamp(requiredInteger(row, "date"), formatter),
                rawValueDateEpochSeconds,
                rawValueDate: valueDateTimestamp(
                    rawValueDateEpochSeconds,
                    formatter,
                ),
                valueDate: valueDateTimestamp(
                    effectiveValueDateEpochSeconds,
                    formatter,
                ),
                amountMinor,
                ...convertedAmount(
                    row,
                    account,
                    amountMinor,
                    options.preferences.homeCurrency,
                ),
                categoryId,
                categoryPath: category?.path ?? [],
                nativeCategoryType: category?.nativeType ?? categoryType,
                categoryType,
                effectiveType,
                bucket,
                reconciliationStatus,
                isVoid: reconciliationStatus === "VOID",
                transferPeerId: optionalInteger(row, "transfer_peer"),
                transferAccountId: optionalInteger(row, "transfer_account"),
                debtId: optionalInteger(row, "debt_id"),
                payeeId,
                parentPayeeId,
                effectivePayeeIds: effectiveIds(payeeId, parentPayeeId),
                methodId,
                parentMethodId,
                effectiveMethodIds: effectiveIds(methodId, parentMethodId),
                tagIds,
                parentTagIds,
                effectiveTagIds: effectiveTags(tagIds, parentTagIds),
                comment: optionalString(row, "comment"),
                parentComment: optionalString(row, "parent_comment"),
                referenceNumber: optionalString(row, "number"),
                originalAmountMinor: optionalInteger(row, "original_amount"),
                originalCurrency: optionalCurrency(row, "original_currency"),
            },
        ];
    });
}

function finalizeAccounts(
    accounts: readonly V189Account[],
    postings: readonly V189Posting[],
): V189Account[] {
    const postingsByAccount = new Map<number, V189Posting[]>();
    for (const posting of postings) {
        const current = postingsByAccount.get(posting.accountId) ?? [];
        current.push(posting);
        postingsByAccount.set(posting.accountId, current);
    }

    return accounts.map((account) => {
        let nativeClosingBalanceMinor = account.openingBalanceMinor;
        let historicalClosingBalanceHomeMinor =
            account.openingBalanceHomeMinor;
        for (const posting of postingsByAccount.get(account.id) ?? []) {
            if (posting.isVoid) {
                continue;
            }
            nativeClosingBalanceMinor = safeAdd(
                nativeClosingBalanceMinor,
                posting.amountMinor,
                `account ${account.id} native closing balance`,
            );
            historicalClosingBalanceHomeMinor = safeAdd(
                historicalClosingBalanceHomeMinor,
                posting.amountHomeMinor,
                `account ${account.id} historical closing balance`,
            );
        }
        const valuationRate = account.valuationRateToHome;
        if (valuationRate === null && nativeClosingBalanceMinor !== 0) {
            throw new Error(
                `Foreign account ${account.id} has a non-zero closing balance but no valuation rate`,
            );
        }
        return {
            ...account,
            nativeClosingBalanceMinor,
            historicalClosingBalanceHomeMinor,
            valuationBalanceHomeMinor: sqliteRound(
                nativeClosingBalanceMinor * (valuationRate ?? 0),
                `account ${account.id} valuation balance`,
            ),
        };
    });
}

function createScope(
    name: V189ScopeName,
    accounts: readonly V189Account[],
    postings: readonly V189Posting[],
): V189Scope {
    const openingBalanceHomeMinor = accounts.reduce(
        (total, account) =>
            safeAdd(
                total,
                account.openingBalanceHomeMinor,
                `${name} opening balance`,
            ),
        0,
    );
    const movementHomeMinor = postings.reduce(
        (total, posting) =>
            safeAdd(
                total,
                posting.isVoid ? 0 : posting.amountHomeMinor,
                `${name} movement`,
            ),
        0,
    );
    const bucketTotal = (bucket: V189PostingBucket): MinorUnits =>
        postings.reduce(
            (total, posting) =>
                safeAdd(
                    total,
                    posting.isVoid || posting.bucket !== bucket
                        ? 0
                        : posting.amountHomeMinor,
                    `${name} ${bucket.toLowerCase()} total`,
                ),
            0,
        );
    const incomesHomeMinor = bucketTotal("INCOME");
    const expensesHomeMinor = bucketTotal("EXPENSE");
    const transfersHomeMinor = bucketTotal("TRANSFER");
    const categorizedMovement = safeAdd(
        safeAdd(
            incomesHomeMinor,
            expensesHomeMinor,
            `${name} income and expense movement`,
        ),
        transfersHomeMinor,
        `${name} categorized movement`,
    );
    if (categorizedMovement !== movementHomeMinor) {
        throw new Error(`${name} bucket totals do not equal movement`);
    }
    const valuationBalanceHomeMinor = accounts.reduce(
        (total, account) =>
            safeAdd(
                total,
                account.valuationBalanceHomeMinor,
                `${name} valuation balance`,
            ),
        0,
    );
    return {
        name,
        accountIds: accounts.map((account) => account.id),
        postingIds: postings.map((posting) => posting.id),
        openingBalanceHomeMinor,
        incomesHomeMinor,
        expensesHomeMinor,
        transfersHomeMinor,
        movementHomeMinor,
        closingFlowBalanceHomeMinor: safeAdd(
            openingBalanceHomeMinor,
            movementHomeMinor,
            `${name} closing flow balance`,
        ),
        valuationBalanceHomeMinor,
    };
}

function assertPartition(scopes: Readonly<Record<V189ScopeName, V189Scope>>): void {
    for (const property of [
        "openingBalanceHomeMinor",
        "incomesHomeMinor",
        "expensesHomeMinor",
        "transfersHomeMinor",
        "movementHomeMinor",
        "closingFlowBalanceHomeMinor",
        "valuationBalanceHomeMinor",
    ] as const) {
        const partition = safeAdd(
            scopes.DEBT[property],
            scopes.REAL_CASH[property],
            `scope partition ${property}`,
        );
        if (scopes.ALL[property] !== partition) {
            throw new Error(`ALL scope partition invariant failed for ${property}`);
        }
    }
    if (
        scopes.ALL.postingIds.length !==
        scopes.DEBT.postingIds.length + scopes.REAL_CASH.postingIds.length
    ) {
        throw new Error("ALL scope posting partition invariant failed");
    }
}

/**
 * Adapts an already-open sql.js database. ZIP and filesystem I/O intentionally
 * live outside this versioned schema adapter.
 */
export function adaptV189(
    database: initSqlJs.Database,
    rawOptions: V189AdapterOptions,
): V189CanonicalDataset {
    validateV189Database(database);
    const options = normalizeOptions(rawOptions);
    const currencies = loadCurrencies(
        database,
        options.preferences.homeCurrency,
    );
    const currencyCodes = new Set(currencies.map((currency) => currency.code));
    const missingCurrencies = [...referencedCurrencyCodes(
        database,
        options.preferences.homeCurrency,
    )].filter((code) => !currencyCodes.has(code));
    if (missingCurrencies.length > 0) {
        throw new Error(
            `Referenced currencies are missing from currency table: ${missingCurrencies.join(", ")}`,
        );
    }
    if (
        !currencies.some(
            (currency) => currency.code === options.preferences.homeCurrency,
        )
    ) {
        throw new Error(
            `Home currency ${options.preferences.homeCurrency} is missing from currency table`,
        );
    }

    const accountDrafts = loadAccounts(database, options);
    const categories = loadCategories(database);
    const payees = loadPayees(database);
    const paymentMethods = loadPaymentMethods(database);
    const tags = loadTags(database);
    const budgets = loadBudgets(database);
    const postings = loadPostings(
        database,
        accountDrafts,
        categories,
        loadTagMap(database),
        options,
    );
    const accounts = finalizeAccounts(accountDrafts, postings);

    const allAccounts = accounts.filter((account) => account.includedInAll);
    const debtAccounts = allAccounts.filter((account) => account.isLiability);
    const realCashAccounts = allAccounts.filter(
        (account) => !account.isLiability,
    );
    const debtPostings = postings.filter(
        (posting) => posting.leafScope === "DEBT",
    );
    const realCashPostings = postings.filter(
        (posting) => posting.leafScope === "REAL_CASH",
    );
    const postingsByScope: Readonly<
        Record<V189ScopeName, readonly V189Posting[]>
    > = {
        ALL: postings,
        DEBT: debtPostings,
        REAL_CASH: realCashPostings,
    };
    const scopes: Readonly<Record<V189ScopeName, V189Scope>> = {
        ALL: createScope("ALL", allAccounts, postings),
        DEBT: createScope("DEBT", debtAccounts, debtPostings),
        REAL_CASH: createScope(
            "REAL_CASH",
            realCashAccounts,
            realCashPostings,
        ),
    };
    assertPartition(scopes);

    return {
        metadata: {
            source: "MyExpenses",
            schemaVersion: V189_SCHEMA_VERSION,
            timeZone: options.timeZone,
            preferences: options.preferences,
            policies: {
                splitParents: "EXCLUDED",
                archiveParents: "EXCLUDED_CONTENT_INCLUDED",
                voidTransactions: "PRESERVED_ZERO_FOR_METRICS",
                debtScope: "ACCOUNT_TYPE_5_LIABILITY",
                allPartition: "ALL_EQUALS_DEBT_PLUS_REAL_CASH",
                staticEquivalentGuard: "ENABLED",
            },
            counts: {
                currencies: currencies.length,
                accounts: accounts.length,
                categories: categories.length,
                postings: postings.length,
                payees: payees.length,
                paymentMethods: paymentMethods.length,
                tags: tags.length,
                budgets: budgets.length,
            },
        },
        currencies,
        accounts,
        categories,
        postings,
        postingsByScope,
        scopes,
        payees,
        paymentMethods,
        tags,
        budgets,
    };
}
