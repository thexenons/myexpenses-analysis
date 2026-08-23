import type initSqlJs from "sql.js";

import { V189_SCHEMA_VERSION } from "./models.ts";

export interface V189SchemaInfo {
    schemaVersion: typeof V189_SCHEMA_VERSION;
    tables: readonly string[];
}

export class V189SchemaError extends Error {
    override readonly name = "V189SchemaError";
}

const REQUIRED_COLUMNS = {
    currency: [
        "_id",
        "code",
        "label",
        "fraction_digits",
        "symbol",
        "commodity_type",
    ],
    accounts: [
        "_id",
        "uuid",
        "label",
        "description",
        "currency",
        "type",
        "flag",
        "opening_balance",
        "exclude_from_totals",
        "dynamic",
        "parent_id",
    ],
    account_types: [
        "_id",
        "label",
        "isAsset",
        "supportsReconciliation",
    ],
    account_flags: ["_id", "visible"],
    categories: [
        "_id",
        "uuid",
        "label",
        "parent_id",
        "type",
        "color",
        "icon",
    ],
    transactions: [
        "_id",
        "uuid",
        "comment",
        "date",
        "value_date",
        "amount",
        "cat_id",
        "account_id",
        "payee_id",
        "transfer_peer",
        "transfer_account",
        "method_id",
        "parent_id",
        "status",
        "cr_status",
        "number",
        "original_amount",
        "original_currency",
        "debt_id",
    ],
    payee: ["_id", "name", "short_name", "parent_id"],
    paymentmethods: ["_id", "label", "is_numbered", "type", "icon"],
    tags: ["_id", "label", "color"],
    transactions_tags: ["transaction_id", "tag_id"],
    equivalent_amounts: ["transaction_id", "currency", "equivalent_amount"],
    account_exchangerates: [
        "account_id",
        "currency_self",
        "currency_other",
        "exchange_rate",
    ],
    prices: ["commodity", "currency", "date", "source", "value"],
    budgets: [
        "_id",
        "uuid",
        "title",
        "description",
        "grouping",
        "account_id",
        "currency",
        "start",
        "end",
        "is_default",
    ],
    budget_allocations: [
        "budget_id",
        "cat_id",
        "year",
        "second",
        "budget",
        "rollOverPrevious",
        "rollOverNext",
        "oneTime",
    ],
} as const satisfies Record<string, readonly string[]>;

function singleValue(
    database: initSqlJs.Database,
    sql: string,
): initSqlJs.SqlValue | undefined {
    const result = database.exec(sql);
    return result[0]?.values[0]?.[0];
}

function tableColumns(
    database: initSqlJs.Database,
    table: keyof typeof REQUIRED_COLUMNS,
): Set<string> {
    const result = database.exec(`PRAGMA table_info("${table}")`);
    const columns = result[0];
    if (columns === undefined) {
        return new Set();
    }
    const nameIndex = columns.columns.indexOf("name");
    if (nameIndex === -1) {
        throw new V189SchemaError(`Could not inspect columns for table ${table}`);
    }
    return new Set(
        columns.values.map((row) => {
            const value = row[nameIndex];
            if (typeof value !== "string") {
                throw new V189SchemaError(
                    `Invalid column metadata for table ${table}`,
                );
            }
            return value;
        }),
    );
}

export function validateV189Database(
    database: initSqlJs.Database,
): V189SchemaInfo {
    const schemaVersion = singleValue(database, "PRAGMA user_version");
    if (schemaVersion !== V189_SCHEMA_VERSION) {
        throw new V189SchemaError(
            `Unsupported MyExpenses schema: expected ${V189_SCHEMA_VERSION}, received ${String(schemaVersion)}`,
        );
    }

    const tableNames = Object.keys(REQUIRED_COLUMNS) as Array<
        keyof typeof REQUIRED_COLUMNS
    >;
    const declaredObjects = database.exec(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')",
    )[0];
    const declaredTables = new Set<string>();
    if (declaredObjects !== undefined) {
        const nameIndex = declaredObjects.columns.indexOf("name");
        const typeIndex = declaredObjects.columns.indexOf("type");
        for (const row of declaredObjects.values) {
            if (row[typeIndex] === "table" && typeof row[nameIndex] === "string") {
                declaredTables.add(row[nameIndex]);
            }
        }
    }

    for (const table of tableNames) {
        if (!declaredTables.has(table)) {
            throw new V189SchemaError(`Missing required v189 table: ${table}`);
        }
        const actualColumns = tableColumns(database, table);
        const missingColumns = REQUIRED_COLUMNS[table].filter(
            (column) => !actualColumns.has(column),
        );
        if (missingColumns.length > 0) {
            throw new V189SchemaError(
                `Table ${table} is missing required columns: ${missingColumns.join(", ")}`,
            );
        }
    }

    return {
        schemaVersion: V189_SCHEMA_VERSION,
        tables: tableNames,
    };
}
