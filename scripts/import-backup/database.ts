import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "ascii");
const EXPECTED_SCHEMA_VERSION = 189 as const;
const MAX_DATABASE_BYTES = 128 * 1024 * 1024;

export const SCHEMA_189_REQUIRED_COLUMNS = Object.freeze({
    account_exchangerates: [
        "account_id",
        "currency_self",
        "currency_other",
        "exchange_rate",
    ],
    account_flags: ["_id", "flag_label", "visible"],
    account_types: ["_id", "label", "isAsset", "supportsReconciliation"],
    accounts: [
        "_id",
        "label",
        "opening_balance",
        "description",
        "currency",
        "type",
        "color",
        "exclude_from_totals",
        "uuid",
        "flag",
        "sealed",
        "dynamic",
        "balance_type",
        "parent_id",
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
    budgets: [
        "_id",
        "title",
        "description",
        "grouping",
        "account_id",
        "currency",
        "start",
        "end",
        "is_default",
        "uuid",
    ],
    categories: [
        "_id",
        "label",
        "parent_id",
        "color",
        "icon",
        "uuid",
        "type",
    ],
    currency: [
        "_id",
        "code",
        "label",
        "fraction_digits",
        "symbol",
        "commodity_type",
    ],
    equivalent_amounts: [
        "transaction_id",
        "currency",
        "equivalent_amount",
    ],
    payee: ["_id", "name", "short_name", "iban", "bic", "parent_id"],
    paymentmethods: ["_id", "label", "is_numbered", "type", "icon"],
    prices: ["commodity", "currency", "date", "source", "value"],
    tags: ["_id", "label", "color"],
    transactions: [
        "_id",
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
        "uuid",
        "original_amount",
        "original_currency",
        "debt_id",
    ],
    transactions_tags: ["tag_id", "transaction_id"],
} as const satisfies Readonly<Record<string, readonly string[]>>);

export type BackupDatabaseErrorCode =
    | "DATABASE_INTEGRITY_ERROR"
    | "INVALID_DATABASE"
    | "SCHEMA_MISMATCH";

export class BackupDatabaseError extends Error {
    readonly code: BackupDatabaseErrorCode;

    constructor(
        code: BackupDatabaseErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.code = code;
        this.name = "BackupDatabaseError";
    }
}

export interface BackupDatabaseMetadata {
    schemaVersion: typeof EXPECTED_SCHEMA_VERSION;
}

let sqlJsPromise: Promise<SqlJsStatic> | undefined;

function getSqlJs(): Promise<SqlJsStatic> {
    sqlJsPromise ??= initSqlJs();
    return sqlJsPromise;
}

function databaseError(
    code: BackupDatabaseErrorCode,
    message: string,
    cause?: unknown,
): BackupDatabaseError {
    return new BackupDatabaseError(
        code,
        message,
        cause === undefined ? undefined : { cause },
    );
}

function firstScalar(database: Database, sql: string): unknown {
    return database.exec(sql)[0]?.values[0]?.[0];
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

function validateRequiredSchema(database: Database): void {
    const existingTables = new Map<string, string>();
    const tableResult = database.exec(
        "SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view')",
    )[0];
    for (const row of tableResult?.values ?? []) {
        const [name, type] = row;
        if (typeof name === "string" && typeof type === "string") {
            existingTables.set(name, type);
        }
    }

    for (const [tableName, requiredColumns] of Object.entries(
        SCHEMA_189_REQUIRED_COLUMNS,
    )) {
        if (existingTables.get(tableName) !== "table") {
            throw databaseError(
                "SCHEMA_MISMATCH",
                "The schema 189 backup is missing a required base table",
            );
        }
        const columns = new Set<string>();
        const result = database.exec(
            `PRAGMA table_info(${quoteIdentifier(tableName)})`,
        )[0];
        for (const row of result?.values ?? []) {
            const name = row[1];
            if (typeof name === "string") {
                columns.add(name);
            }
        }
        for (const columnName of requiredColumns) {
            if (!columns.has(columnName)) {
                throw databaseError(
                    "SCHEMA_MISMATCH",
                    "The schema 189 backup is missing a required column",
                );
            }
        }
    }
}

function validateDatabase(database: Database): BackupDatabaseMetadata {
    database.run("PRAGMA trusted_schema = OFF");
    database.run("PRAGMA query_only = ON");
    if (
        firstScalar(database, "PRAGMA trusted_schema") !== 0 ||
        firstScalar(database, "PRAGMA query_only") !== 1
    ) {
        throw databaseError(
            "INVALID_DATABASE",
            "SQLite read-only safety settings could not be applied",
        );
    }

    const schemaVersion = firstScalar(database, "PRAGMA user_version");
    if (schemaVersion !== EXPECTED_SCHEMA_VERSION) {
        throw databaseError(
            "SCHEMA_MISMATCH",
            `Expected MyExpenses schema ${EXPECTED_SCHEMA_VERSION}`,
        );
    }
    validateRequiredSchema(database);

    const quickCheck = database.exec("PRAGMA quick_check")[0]?.values ?? [];
    if (
        quickCheck.length !== 1 ||
        quickCheck[0]?.length !== 1 ||
        quickCheck[0][0] !== "ok"
    ) {
        throw databaseError(
            "DATABASE_INTEGRITY_ERROR",
            "The SQLite integrity check failed",
        );
    }
    const foreignKeyViolations =
        database.exec("PRAGMA foreign_key_check")[0]?.values ?? [];
    if (foreignKeyViolations.length > 0) {
        throw databaseError(
            "DATABASE_INTEGRITY_ERROR",
            "The SQLite foreign-key check failed",
        );
    }

    return { schemaVersion: EXPECTED_SCHEMA_VERSION };
}

function assertDatabaseBytes(bytes: Uint8Array): void {
    if (!(bytes instanceof Uint8Array)) {
        throw databaseError(
            "INVALID_DATABASE",
            "The database must be provided as bytes",
        );
    }
    if (bytes.byteLength > MAX_DATABASE_BYTES) {
        throw databaseError(
            "INVALID_DATABASE",
            "The database exceeds the in-memory size limit",
        );
    }
    if (
        bytes.byteLength < SQLITE_HEADER.byteLength ||
        !Buffer.from(
            bytes.buffer,
            bytes.byteOffset,
            SQLITE_HEADER.byteLength,
        ).equals(SQLITE_HEADER)
    ) {
        throw databaseError(
            "INVALID_DATABASE",
            "The BACKUP entry is not a SQLite database",
        );
    }
}

/**
 * Opens and validates the SQLite backup in WASM, then always closes it after
 * the supplied callback settles. Callers receive no file-system handle and
 * the database starts in query-only, untrusted-schema mode.
 */
export async function withBackupDatabase<T>(
    bytes: Uint8Array,
    operation: (
        database: Database,
        metadata: BackupDatabaseMetadata,
    ) => T | Promise<T>,
): Promise<T> {
    assertDatabaseBytes(bytes);

    let sqlJs: SqlJsStatic;
    try {
        sqlJs = await getSqlJs();
    } catch (error) {
        throw databaseError(
            "INVALID_DATABASE",
            "The SQLite engine could not be initialized",
            error,
        );
    }

    let database: Database;
    try {
        database = new sqlJs.Database(bytes);
    } catch (error) {
        throw databaseError(
            "INVALID_DATABASE",
            "The BACKUP entry could not be opened as SQLite",
            error,
        );
    }

    let validated = false;
    try {
        let metadata: BackupDatabaseMetadata;
        try {
            metadata = validateDatabase(database);
            validated = true;
        } catch (error) {
            if (error instanceof BackupDatabaseError) {
                throw error;
            }
            throw databaseError(
                "INVALID_DATABASE",
                "The BACKUP entry could not be validated",
                error,
            );
        }
        return await operation(database, metadata);
    } catch (error) {
        if (validated || error instanceof BackupDatabaseError) {
            throw error;
        }
        throw databaseError(
            "INVALID_DATABASE",
            "The BACKUP entry could not be validated",
            error,
        );
    } finally {
        database.close();
    }
}
