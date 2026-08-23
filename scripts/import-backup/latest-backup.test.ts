import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findLatestBackupFile } from "./latest-backup.ts";

test("selects the latest direct backup by its canonical filename timestamp", async () => {
    const directory = await mkdtemp(join(tmpdir(), "latest-backup-test-"));
    try {
        await Promise.all([
            writeFile(
                join(directory, "myexpenses-backup-20260822-210453.zip"),
                "older",
            ),
            writeFile(
                join(directory, "myexpenses-backup-20260823-165614.zip"),
                "latest",
            ),
            writeFile(join(directory, "unrelated.zip"), "ignored"),
        ]);

        assert.equal(
            await findLatestBackupFile(directory),
            join(directory, "myexpenses-backup-20260823-165614.zip"),
        );
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rejects missing, symlinked and empty input directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "latest-backup-errors-test-"));
    const directory = join(root, "backups");
    const link = join(root, "link");
    try {
        await assert.rejects(
            findLatestBackupFile(directory),
            /cannot be inspected/iu,
        );
        await writeFile(directory, "not a directory");
        await assert.rejects(findLatestBackupFile(directory), /real directory/iu);
        await rm(directory);
        await writeFile(join(root, "target"), "target");
        await symlink(root, link);
        await assert.rejects(findLatestBackupFile(link), /real directory/iu);
        await assert.rejects(
            findLatestBackupFile(root),
            /contains no valid/iu,
        );
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});
