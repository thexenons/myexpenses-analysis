import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    BackupArchiveError,
    readBackupArchive,
} from "./archive.ts";
import {
    corruptBackupZipFixtureEntryCrc,
    createBackupZipFixture,
    createSchema189DatabaseFixture,
    markBackupZipFixtureEntryAsSymbolicLink,
    markBackupZipFixtureEntryEncrypted,
    renameBackupZipFixtureEntry,
    SAFE_PREFERENCES_XML_FIXTURE,
} from "./test-fixtures.ts";

async function withFixtureFile<T>(
    bytes: Uint8Array,
    operation: (filePath: string, directoryPath: string) => Promise<T>,
): Promise<T> {
    const directoryPath = await mkdtemp(
        join(tmpdir(), "myexpenses-backup-archive-test-"),
    );
    const filePath = join(directoryPath, "backup.zip");
    try {
        await writeFile(filePath, bytes);
        return await operation(filePath, directoryPath);
    } finally {
        await rm(directoryPath, { force: true, recursive: true });
    }
}

function hasArchiveErrorCode(code: BackupArchiveError["code"]) {
    return (error: unknown): boolean =>
        error instanceof BackupArchiveError && error.code === code;
}

test("reads only allowlisted backup entries in memory and ignores pictures", async () => {
    const database = await createSchema189DatabaseFixture();
    const uiSettings = new Uint8Array([1, 2, 3, 4]);
    const fixture = await createBackupZipFixture({
        database,
        pictures: [
            {
                data: new Uint8Array([9, 8, 7]),
                name: "Pictures/anonymous.jpg",
            },
        ],
        uiSettings,
    });

    await withFixtureFile(fixture, async (filePath, directoryPath) => {
        const contents = await readBackupArchive(filePath);

        assert.deepEqual(Buffer.from(contents.database), Buffer.from(database));
        assert.equal(
            new TextDecoder().decode(contents.preferencesXml),
            SAFE_PREFERENCES_XML_FIXTURE,
        );
        assert.deepEqual(
            Buffer.from(contents.uiSettings ?? []),
            Buffer.from(uiSettings),
        );
        assert.equal(contents.metadata.entryCount, 4);
        assert.equal(contents.metadata.pictureCount, 1);
        assert.equal(contents.metadata.ignoredPictureBytes, 3);
        assert.deepEqual(await readdir(directoryPath), ["backup.zip"]);
    });
});

test("rejects corrupt ZIPs and missing required entries", async () => {
    await withFixtureFile(
        new Uint8Array([0x50, 0x4b, 0x00, 0x00]),
        async (filePath) => {
            await assert.rejects(
                readBackupArchive(filePath),
                hasArchiveErrorCode("INVALID_ZIP"),
            );
        },
    );

    const missingPreferences = await createBackupZipFixture({
        includePreferences: false,
    });
    await withFixtureFile(missingPreferences, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            hasArchiveErrorCode("MISSING_ENTRY"),
        );
    });

    const fixture = await createBackupZipFixture();
    const badCrc = corruptBackupZipFixtureEntryCrc(fixture, "BACKUP_PREF");
    await withFixtureFile(badCrc, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            hasArchiveErrorCode("INVALID_ZIP"),
        );
    });
});

test("rejects duplicate, traversal and unexpected entries", async () => {
    const database = await createSchema189DatabaseFixture();
    const duplicatePlaceholder = await createBackupZipFixture({
        database,
        extraEntries: [{ data: database, name: "DUPLIC" }],
    });
    const duplicate = renameBackupZipFixtureEntry(
        duplicatePlaceholder,
        "DUPLIC",
        "BACKUP",
    );
    await withFixtureFile(duplicate, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            hasArchiveErrorCode("DUPLICATE_ENTRY"),
        );
    });

    const traversalPlaceholder = await createBackupZipFixture({
        extraEntries: [{ data: "ignored", name: "Pictures/x" }],
    });
    const traversal = renameBackupZipFixtureEntry(
        traversalPlaceholder,
        "Pictures/x",
        "../evil/xx",
    );
    await withFixtureFile(traversal, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            (error: unknown) =>
                error instanceof BackupArchiveError &&
                (error.code === "INVALID_ENTRY_PATH" ||
                    error.code === "INVALID_ZIP"),
        );
    });

    const unexpected = await createBackupZipFixture({
        extraEntries: [{ data: "ignored", name: "private.txt" }],
    });
    await withFixtureFile(unexpected, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            hasArchiveErrorCode("UNEXPECTED_ENTRY"),
        );
    });
});

test("rejects encrypted and symbolic-link entries", async () => {
    const fixture = await createBackupZipFixture();
    const encrypted = markBackupZipFixtureEntryEncrypted(fixture, "BACKUP");
    await withFixtureFile(encrypted, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            hasArchiveErrorCode("ENCRYPTED_ENTRY"),
        );
    });

    const symbolicLink = markBackupZipFixtureEntryAsSymbolicLink(
        fixture,
        "BACKUP_PREF",
    );
    await withFixtureFile(symbolicLink, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath),
            hasArchiveErrorCode("SYMBOLIC_LINK"),
        );
    });
});

test("enforces compressed, uncompressed and ratio limits before extraction", async () => {
    const fixture = await createBackupZipFixture();
    await withFixtureFile(fixture, async (filePath) => {
        await assert.rejects(
            readBackupArchive(filePath, {
                limits: { maxCompressionRatio: 1 },
            }),
            hasArchiveErrorCode("ARCHIVE_LIMIT_EXCEEDED"),
        );
        await assert.rejects(
            readBackupArchive(filePath, {
                limits: { maxDatabaseBytes: 64 },
            }),
            hasArchiveErrorCode("ARCHIVE_LIMIT_EXCEEDED"),
        );
        await assert.rejects(
            readBackupArchive(filePath, {
                limits: { maxArchiveBytes: 64 },
            }),
            hasArchiveErrorCode("ARCHIVE_LIMIT_EXCEEDED"),
        );
    });
});

test("rejects a symbolic link used as the archive path", async () => {
    const fixture = await createBackupZipFixture();
    await withFixtureFile(fixture, async (filePath, directoryPath) => {
        const linkPath = join(directoryPath, "backup-link.zip");
        await symlink(filePath, linkPath);
        await assert.rejects(
            readBackupArchive(linkPath),
            hasArchiveErrorCode("INVALID_ARCHIVE_PATH"),
        );
    });
});
