import assert from "node:assert/strict";
import test from "node:test";

import {
    parseImportBackupArguments,
    runImportBackupCli,
} from "./cli.ts";
import type {
    ImportBackupOptions,
    ImportBackupResult,
} from "./import-backup.ts";

test("parses required CLI options and applies only the documented output default", () => {
    assert.deepEqual(
        parseImportBackupArguments([
            "--",
            "--input",
            "backup.zip",
            "--time-zone",
            "Europe/Madrid",
        ]),
        {
            inputPath: "backup.zip",
            outputPath: "data/app-dataset.json",
            timeZone: "Europe/Madrid",
        },
    );
    assert.deepEqual(
        parseImportBackupArguments([
            "--input=backup.zip",
            "--output=custom.json",
            "--time-zone=UTC",
        ]),
        {
            inputPath: "backup.zip",
            outputPath: "custom.json",
            timeZone: "UTC",
        },
    );
    assert.throws(
        () => parseImportBackupArguments(["--time-zone", "UTC"]),
        /--input is required/iu,
    );
    assert.throws(
        () => parseImportBackupArguments(["--input", "backup.zip"]),
        /--time-zone is required/iu,
    );
});

test("runs the importer and emits only a non-sensitive count summary", async () => {
    let received: ImportBackupOptions | undefined;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const implementation = async (
        options: ImportBackupOptions,
    ): Promise<ImportBackupResult> => {
        received = options;
        return {
            accountCount: 39,
            budgetCount: 1,
            categoryCount: 81,
            outputPath: "/private/path/app-dataset.json",
            postingCount: 13_022,
        };
    };

    const exitCode = await runImportBackupCli(
        [
            "--input",
            "/private/path/backup.zip",
            "--time-zone",
            "Europe/Madrid",
        ],
        implementation,
        {
            stdout: (message) => stdout.push(message),
            stderr: (message) => stderr.push(message),
        },
    );

    assert.equal(exitCode, 0);
    assert.deepEqual(received, {
        inputPath: "/private/path/backup.zip",
        outputPath: "data/app-dataset.json",
        timeZone: "Europe/Madrid",
    });
    assert.deepEqual(stderr, []);
    assert.equal(
        stdout.join(""),
        "Import complete: 39 accounts, 81 categories, 13022 postings, 1 budgets.\n",
    );
    assert.doesNotMatch(stdout.join(""), /private|sha|backup\.zip/iu);
});

test("returns failure without invoking the importer for invalid arguments", async () => {
    let calls = 0;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runImportBackupCli(
        ["--input", "backup.zip"],
        async () => {
            calls++;
            throw new Error("must not run");
        },
        {
            stdout: (message) => stdout.push(message),
            stderr: (message) => stderr.push(message),
        },
    );

    assert.equal(exitCode, 1);
    assert.equal(calls, 0);
    assert.deepEqual(stdout, []);
    assert.match(stderr.join(""), /--time-zone is required/iu);
});

test("redacts unknown importer errors", async () => {
    const stderr: string[] = [];
    const exitCode = await runImportBackupCli(
        ["--input", "backup.zip", "--time-zone", "Europe/Madrid"],
        async () => {
            throw new Error("private payee /home/person/backup.zip");
        },
        {
            stdout: () => undefined,
            stderr: (message) => stderr.push(message),
        },
    );

    assert.equal(exitCode, 1);
    assert.match(stderr.join(""), /failed validation/iu);
    assert.doesNotMatch(stderr.join(""), /private payee|home\/person/iu);
});
