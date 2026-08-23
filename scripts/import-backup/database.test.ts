import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "sql.js";

import {
    BackupDatabaseError,
    withBackupDatabase,
} from "./database.ts";
import { createSchema189DatabaseFixture } from "./test-fixtures.ts";

function hasDatabaseErrorCode(code: BackupDatabaseError["code"]) {
    return (error: unknown): boolean =>
        error instanceof BackupDatabaseError && error.code === code;
}

test("opens schema 189 query-only with untrusted schema and closes finally", async () => {
    const bytes = await createSchema189DatabaseFixture();
    let databaseAfterCallback: Database | undefined;

    const result = await withBackupDatabase(bytes, (database, metadata) => {
        databaseAfterCallback = database;
        assert.deepEqual(metadata, { schemaVersion: 189 });
        assert.equal(database.exec("PRAGMA query_only")[0]?.values[0]?.[0], 1);
        assert.equal(
            database.exec("PRAGMA trusted_schema")[0]?.values[0]?.[0],
            0,
        );
        assert.throws(
            () => database.run("INSERT INTO tags (_id, label) VALUES (1, 'x')"),
            /read-?only/iu,
        );
        return database.exec("SELECT COUNT(*) FROM accounts")[0]?.values[0]?.[0];
    });

    assert.equal(result, 0);
    const closedDatabase = databaseAfterCallback;
    assert.ok(closedDatabase !== undefined);
    assert.throws(() => closedDatabase.exec("SELECT 1"), /closed/iu);
});

test("rejects non-SQLite bytes and unknown schema versions", async () => {
    await assert.rejects(
        withBackupDatabase(new Uint8Array([1, 2, 3]), () => undefined),
        hasDatabaseErrorCode("INVALID_DATABASE"),
    );
    const wrongVersion = await createSchema189DatabaseFixture({
        schemaVersion: 188,
    });
    await assert.rejects(
        withBackupDatabase(wrongVersion, () => undefined),
        hasDatabaseErrorCode("SCHEMA_MISMATCH"),
    );
});

test("rejects schema 189 files missing required tables or columns", async () => {
    const missingTable = await createSchema189DatabaseFixture({
        missingTable: "transactions",
    });
    await assert.rejects(
        withBackupDatabase(missingTable, () => undefined),
        hasDatabaseErrorCode("SCHEMA_MISMATCH"),
    );

    const missingColumn = await createSchema189DatabaseFixture({
        missingColumn: { columnName: "type", tableName: "categories" },
    });
    await assert.rejects(
        withBackupDatabase(missingColumn, () => undefined),
        hasDatabaseErrorCode("SCHEMA_MISMATCH"),
    );
});

test("rejects foreign-key violations", async () => {
    const bytes = await createSchema189DatabaseFixture({
        extraSql: [
            "CREATE TABLE fixture_parent (id INTEGER PRIMARY KEY)",
            "CREATE TABLE fixture_child (parent_id INTEGER REFERENCES fixture_parent(id))",
            "INSERT INTO fixture_child (parent_id) VALUES (999)",
        ],
    });

    await assert.rejects(
        withBackupDatabase(bytes, () => undefined),
        hasDatabaseErrorCode("DATABASE_INTEGRITY_ERROR"),
    );
});

test("preserves callback failures while still closing the database", async () => {
    const bytes = await createSchema189DatabaseFixture();
    const expected = new Error("mapping failed");
    let databaseAfterCallback: Database | undefined;

    await assert.rejects(
        withBackupDatabase(bytes, (database) => {
            databaseAfterCallback = database;
            throw expected;
        }),
        (error: unknown) => error === expected,
    );
    const closedDatabase = databaseAfterCallback;
    assert.ok(closedDatabase !== undefined);
    assert.throws(() => closedDatabase.exec("SELECT 1"), /closed/iu);
});
