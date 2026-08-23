import assert from "node:assert/strict";
import test from "node:test";

import { parseBackupFileName } from "./backup-file.ts";

test("parses canonical MyExpenses backup timestamps and ignores other files", () => {
    assert.deepEqual(
        parseBackupFileName("myexpenses-backup-20260823-165614.zip"),
        {
            name: "myexpenses-backup-20260823-165614.zip",
            timestamp: "20260823165614",
        },
    );
    assert.equal(parseBackupFileName("app-dataset.json"), null);
    assert.equal(parseBackupFileName("myexpenses-backup-latest.zip"), null);
});

test("rejects impossible calendar timestamps", () => {
    assert.throws(
        () => parseBackupFileName("myexpenses-backup-20260230-250000.zip"),
        /invalid timestamp/iu,
    );
});
