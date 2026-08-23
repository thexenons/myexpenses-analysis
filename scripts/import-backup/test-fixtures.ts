import initSqlJs from "sql.js";
import { ZipFile } from "yazl";

import { SCHEMA_189_REQUIRED_COLUMNS } from "./database.ts";

const FIXTURE_DATE = new Date("2024-01-01T00:00:00.000Z");
const LOCAL_HEADER_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const CENTRAL_HEADER_SIGNATURE = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

export interface Schema189DatabaseFixtureOptions {
    extraSql?: readonly string[];
    missingColumn?: { columnName: string; tableName: string };
    missingTable?: string;
    schemaVersion?: number;
}

export interface BackupZipFixtureEntry {
    compress?: boolean;
    data: Uint8Array | string;
    mode?: number;
    name: string;
}

export interface BackupZipFixtureOptions {
    database?: Uint8Array;
    extraEntries?: readonly BackupZipFixtureEntry[];
    includeDatabase?: boolean;
    includePreferences?: boolean;
    includeUiSettings?: boolean;
    pictures?: readonly BackupZipFixtureEntry[];
    preferencesXml?: Uint8Array | string;
    uiSettings?: Uint8Array;
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

function fixtureColumnDefinition(columnName: string): string {
    if (columnName === "_id") {
        return `${quoteIdentifier(columnName)} INTEGER PRIMARY KEY`;
    }
    return `${quoteIdentifier(columnName)} ANY`;
}

export async function createSchema189DatabaseFixture(
    options: Schema189DatabaseFixtureOptions = {},
): Promise<Uint8Array> {
    const schemaVersion = options.schemaVersion ?? 189;
    if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 0) {
        throw new Error("Fixture schemaVersion must be a non-negative integer");
    }

    const sqlJs = await initSqlJs();
    const database = new sqlJs.Database();
    try {
        database.run(`PRAGMA user_version = ${schemaVersion}`);
        for (const [tableName, requiredColumns] of Object.entries(
            SCHEMA_189_REQUIRED_COLUMNS,
        )) {
            if (tableName === options.missingTable) {
                continue;
            }
            const columns = requiredColumns.filter(
                (columnName) =>
                    tableName !== options.missingColumn?.tableName ||
                    columnName !== options.missingColumn.columnName,
            );
            database.run(
                `CREATE TABLE ${quoteIdentifier(tableName)} (${columns
                    .map(fixtureColumnDefinition)
                    .join(", ")})`,
            );
        }
        for (const sql of options.extraSql ?? []) {
            database.run(sql);
        }
        return database.export();
    } finally {
        database.close();
    }
}

/** Anonymous but relationally complete v189 fixture for import-pipeline tests. */
export async function createImportDatabaseFixture(): Promise<Uint8Array> {
    return createSchema189DatabaseFixture({
        extraSql: [
            `INSERT INTO currency
                (_id, code, label, fraction_digits, symbol, commodity_type)
             VALUES
                (1, 'EUR', 'Euro', 2, 'EUR', 'FIAT'),
                (2, 'USD', 'Dollar', 2, 'USD', 'FIAT')`,
            `INSERT INTO account_types
                (_id, label, isAsset, supportsReconciliation)
             VALUES
                (1, 'CASH', 1, 0),
                (2, 'BANK', 1, 1),
                (5, 'LIABILITY', 0, 0)`,
            `INSERT INTO account_flags (_id, flag_label, visible)
             VALUES (1, 'Fixture', 1)`,
            `INSERT INTO accounts
                (_id, uuid, label, description, currency, type, flag,
                 opening_balance, exclude_from_totals, dynamic, parent_id)
             VALUES
                (1, '11111111-1111-4111-8111-111111111111', 'Cash', '', 'EUR', 1, 1, 100, 0, 0, NULL),
                (2, '22222222-2222-4222-8222-222222222222', 'Debt', NULL, 'EUR', 5, 1, 200, 0, 0, NULL),
                (3, '33333333-3333-4333-8333-333333333333', 'Static', NULL, 'USD', 2, 1, 0, 0, 0, NULL),
                (4, '44444444-4444-4444-8444-444444444444', 'Dynamic', NULL, 'USD', 2, 1, 0, 0, 1, NULL)`,
            `INSERT INTO account_exchangerates
                (account_id, currency_self, currency_other, exchange_rate)
             VALUES (3, 'USD', 'EUR', 2.0), (4, 'USD', 'EUR', 2.0)`,
            `INSERT INTO prices (commodity, currency, date, source, value)
             VALUES ('USD', 'EUR', '2026-08-22', 'user', 3.0)`,
            `INSERT INTO categories
                (_id, uuid, label, parent_id, type, color, icon)
             VALUES
                (0, NULL, 'Split', 0, NULL, NULL, NULL),
                (10, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Expense', NULL, 1, NULL, NULL),
                (11, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Income', NULL, 2, NULL, NULL),
                (12, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Transfer', NULL, 0, NULL, NULL),
                (13, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Neutral', NULL, 3, NULL, NULL)`,
            `INSERT INTO payee
                (_id, name, short_name, iban, bic, parent_id)
             VALUES
                (1, 'Child payee', NULL, 'PRIVATE-IBAN', 'PRIVATE-BIC', NULL),
                (2, 'Parent payee', NULL, NULL, NULL, NULL)`,
            `INSERT INTO paymentmethods (_id, label, is_numbered, type, icon)
             VALUES
                (1, 'Neutral method', 0, -1, NULL),
                (2, 'Expense method', 0, 0, NULL),
                (3, 'Income method', 0, 1, NULL)`,
            `INSERT INTO tags (_id, label, color)
             VALUES (1, 'Child tag', NULL), (2, 'Parent tag', NULL)`,
            `INSERT INTO transactions
                (_id, uuid, comment, date, value_date, amount, cat_id,
                 account_id, payee_id, transfer_peer, transfer_account,
                 method_id, parent_id, status, cr_status, number,
                 original_amount, original_currency, debt_id)
             VALUES
                (1, '10000000-0000-4000-8000-000000000001', 'Direct', 1787425493, 1787425493, -100, 10, 1, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, '___', NULL),
                (2, '10000000-0000-4000-8000-000000000002', NULL, 1787425493, 1787425493, 40, 13, 1, NULL, NULL, NULL, NULL, NULL, 0, 'CLEARED', NULL, NULL, NULL, NULL),
                (3, '10000000-0000-4000-8000-000000000003', NULL, 1787425493, 0, 999, 11, 1, NULL, NULL, NULL, NULL, NULL, 0, 'VOID', NULL, NULL, NULL, NULL),
                (4, '10000000-0000-4000-8000-000000000004', NULL, 1787425493, 1787425493, -50, 12, 1, NULL, 5, 2, NULL, NULL, 0, 'RECONCILED', NULL, NULL, NULL, NULL),
                (5, '10000000-0000-4000-8000-000000000004', NULL, 1787425493, 1787425493, 50, 12, 2, NULL, 4, 1, NULL, NULL, 0, 'RECONCILED', NULL, NULL, NULL, NULL),
                (6, '10000000-0000-4000-8000-000000000006', 'Parent comment', 1787425493, 1787425493, 300, 0, 1, 2, NULL, NULL, 2, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (7, '10000000-0000-4000-8000-000000000007', NULL, 1787425493, 0, 100, 11, 1, 1, NULL, NULL, 1, 6, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (8, '10000000-0000-4000-8000-000000000008', 'Child comment', 1787425493, 1787425493, 200, 10, 1, NULL, NULL, NULL, NULL, 6, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (9, '10000000-0000-4000-8000-000000000009', NULL, 1787425493, 1787425493, 10, 11, 3, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, 10, 'USD', NULL),
                (10, '10000000-0000-4000-8000-000000000010', NULL, 1787425493, 1787425493, 10, 11, 4, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (11, '10000000-0000-4000-8000-000000000011', NULL, 1787425493, 1787425493, 100, 0, 4, NULL, NULL, NULL, NULL, NULL, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (12, '10000000-0000-4000-8000-000000000012', NULL, 1787425493, 1787425493, 40, 11, 4, NULL, NULL, NULL, NULL, 11, 0, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (13, '10000000-0000-4000-8000-000000000013', NULL, 1787425493, 1787425493, 77, NULL, 1, NULL, NULL, NULL, NULL, NULL, 4, 'UNRECONCILED', NULL, NULL, NULL, NULL),
                (14, '10000000-0000-4000-8000-000000000014', NULL, 1787425493, 1787425493, 77, 11, 1, NULL, NULL, NULL, NULL, 13, 5, 'UNRECONCILED', NULL, NULL, NULL, NULL)`,
            `INSERT INTO equivalent_amounts
                (transaction_id, currency, equivalent_amount)
             VALUES (10, 'EUR', 30), (11, 'EUR', 250)`,
            `INSERT INTO transactions_tags (transaction_id, tag_id)
             VALUES (6, 2), (7, 1)`,
            `INSERT INTO budgets
                (_id, uuid, title, description, grouping, account_id,
                 currency, start, end, is_default)
             VALUES
                (1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Monthly', '', 'MONTH', 1, '___', NULL, NULL, 1)`,
            `INSERT INTO budget_allocations
                (budget_id, cat_id, year, second, budget,
                 rollOverPrevious, rollOverNext, oneTime)
             VALUES
                (1, 0, NULL, NULL, 500, 0, 0, 0),
                (1, 10, 2026, 8, 100, 5, 7, 1)`,
        ],
    });
}

export const SAFE_PREFERENCES_XML_FIXTURE = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="currentversion" value="871" />
    <int name="first_install_db_schema_version" value="170" />
    <string name="home_currency">EUR</string>
    <boolean name="transaction_time" value="true" />
    <string name="group_month_start">1</string>
    <string name="group_week_start">2</string>
    <boolean name="history_include_transfers" value="false" />
    <boolean name="unmapped_transaction_as_transfer" value="false" />
    <long name="default_transfer_category" value="1" />
    <boolean name="value_date" value="false" />
    <boolean name="automatic_exchange_rate_download" value="false" />
    <string name="exchange_rate_provider">FRANKFURTER</string>
    <string name="pref_new_licence_key">fixture-secret-that-must-be-ignored</string>
    <string name="licence_email">private@example.invalid</string>
</map>`;

function toBuffer(value: Uint8Array | string): Buffer {
    if (typeof value === "string") {
        return Buffer.from(value, "utf8");
    }
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function collectZip(zipFile: ZipFile): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        zipFile.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        zipFile.outputStream.once("error", reject);
        zipFile.outputStream.once("end", () => resolve(Buffer.concat(chunks)));
    });
}

function addFixtureEntry(zipFile: ZipFile, entry: BackupZipFixtureEntry): void {
    zipFile.addBuffer(toBuffer(entry.data), entry.name, {
        compress: entry.compress ?? true,
        mode: entry.mode ?? 0o100600,
        mtime: FIXTURE_DATE,
    });
}

export async function createBackupZipFixture(
    options: BackupZipFixtureOptions = {},
): Promise<Uint8Array> {
    const database =
        options.database ?? (await createSchema189DatabaseFixture());
    const zipFile = new ZipFile();
    const result = collectZip(zipFile);

    if (options.includeDatabase !== false) {
        addFixtureEntry(zipFile, { data: database, name: "BACKUP" });
    }
    if (options.includePreferences !== false) {
        addFixtureEntry(zipFile, {
            data: options.preferencesXml ?? SAFE_PREFERENCES_XML_FIXTURE,
            name: "BACKUP_PREF",
        });
    }
    if (options.includeUiSettings !== false) {
        addFixtureEntry(zipFile, {
            data: options.uiSettings ?? new Uint8Array(),
            name: "ui_settings.preferences_pb",
        });
    }
    for (const picture of options.pictures ?? []) {
        addFixtureEntry(zipFile, picture);
    }
    for (const entry of options.extraEntries ?? []) {
        addFixtureEntry(zipFile, entry);
    }
    zipFile.end();
    return result;
}

type HeaderKind = "central" | "local";

function visitEntryHeaders(
    bytes: Buffer,
    entryName: string,
    visit: (headerOffset: number, kind: HeaderKind) => void,
): void {
    const expectedName = Buffer.from(entryName, "utf8");
    let localCount = 0;
    let centralCount = 0;

    for (const [signature, kind] of [
        [LOCAL_HEADER_SIGNATURE, "local"],
        [CENTRAL_HEADER_SIGNATURE, "central"],
    ] as const) {
        let searchPosition = 0;
        while (searchPosition < bytes.byteLength) {
            const headerOffset = bytes.indexOf(signature, searchPosition);
            if (headerOffset === -1) {
                break;
            }
            const nameLengthOffset =
                headerOffset + (kind === "local" ? 26 : 28);
            if (nameLengthOffset + 2 > bytes.byteLength) {
                throw new Error("Fixture ZIP has a truncated header");
            }
            const nameLength = bytes.readUInt16LE(nameLengthOffset);
            const nameOffset = headerOffset + (kind === "local" ? 30 : 46);
            const nameEnd = nameOffset + nameLength;
            if (
                nameEnd <= bytes.byteLength &&
                bytes.subarray(nameOffset, nameEnd).equals(expectedName)
            ) {
                visit(headerOffset, kind);
                if (kind === "local") {
                    localCount++;
                } else {
                    centralCount++;
                }
            }
            searchPosition = headerOffset + signature.byteLength;
        }
    }

    if (localCount !== 1 || centralCount !== 1) {
        throw new Error(
            "Expected exactly one local and central fixture ZIP entry header",
        );
    }
}

export function renameBackupZipFixtureEntry(
    bytes: Uint8Array,
    sourceName: string,
    targetName: string,
): Uint8Array {
    const source = Buffer.from(sourceName, "utf8");
    const target = Buffer.from(targetName, "utf8");
    if (source.byteLength !== target.byteLength) {
        throw new Error("Fixture ZIP entry names must have equal UTF-8 lengths");
    }
    const result = Buffer.from(bytes);
    visitEntryHeaders(result, sourceName, (headerOffset, kind) => {
        const nameOffset = headerOffset + (kind === "local" ? 30 : 46);
        target.copy(result, nameOffset);
    });
    return result;
}

export function markBackupZipFixtureEntryEncrypted(
    bytes: Uint8Array,
    entryName: string,
): Uint8Array {
    const result = Buffer.from(bytes);
    visitEntryHeaders(result, entryName, (headerOffset, kind) => {
        const flagOffset = headerOffset + (kind === "local" ? 6 : 8);
        result.writeUInt16LE(result.readUInt16LE(flagOffset) | 0x0001, flagOffset);
    });
    return result;
}

export function corruptBackupZipFixtureEntryCrc(
    bytes: Uint8Array,
    entryName: string,
): Uint8Array {
    const result = Buffer.from(bytes);
    visitEntryHeaders(result, entryName, (headerOffset, kind) => {
        if (kind === "central") {
            const crcOffset = headerOffset + 16;
            result.writeUInt32LE(
                (result.readUInt32LE(crcOffset) ^ 0x00000001) >>> 0,
                crcOffset,
            );
        }
    });
    return result;
}

export function markBackupZipFixtureEntryAsSymbolicLink(
    bytes: Uint8Array,
    entryName: string,
): Uint8Array {
    const result = Buffer.from(bytes);
    visitEntryHeaders(result, entryName, (headerOffset, kind) => {
        if (kind !== "central") {
            return;
        }
        const versionMadeByOffset = headerOffset + 4;
        result.writeUInt16LE(
            (3 << 8) | (result.readUInt16LE(versionMadeByOffset) & 0xff),
            versionMadeByOffset,
        );
        const externalAttributesOffset = headerOffset + 38;
        const existingPermissions =
            result.readUInt32LE(externalAttributesOffset) & 0x0000ffff;
        result.writeUInt32LE(
            (existingPermissions | (0o120777 << 16)) >>> 0,
            externalAttributesOffset,
        );
    });
    return result;
}
