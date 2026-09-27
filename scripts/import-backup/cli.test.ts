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

test("defaults to the latest data backup and Europe/Madrid", () => {
    assert.deepEqual(parseImportBackupArguments([]), {
        inputDirectoryPath: "data",
        outputPath: "data/app-dataset.json",
        timeZone: "Europe/Madrid",
    });
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
        () =>
            parseImportBackupArguments([
                "--input=backup.zip",
                "--input-directory=data",
            ]),
        /either --input or --input-directory/iu,
    );
    assert.throws(
        () => parseImportBackupArguments(["--time-zone", ""]),
        /--time-zone must not be empty/iu,
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
        ["--input", "/private/path/backup.zip"],
        { importBackup: implementation },
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
        importedAt: received?.importedAt,
    });
    assert.match(received?.importedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    assert.deepEqual(stderr, []);
    assert.equal(
        stdout.join(""),
        "Import complete: 39 accounts, 81 categories, 13022 postings, 1 budgets.\n",
    );
    assert.doesNotMatch(stdout.join(""), /private|sha|backup\.zip/iu);
});

test("injects an actual import instant and only a recognized filename timestamp", async () => {
    const received: ImportBackupOptions[] = [];
    const implementation = async (options: ImportBackupOptions): Promise<ImportBackupResult> => {
        received.push(options);
        return { accountCount: 0, budgetCount: 0, categoryCount: 0, outputPath: options.outputPath, postingCount: 0 };
    };
    const io = { stdout: () => undefined, stderr: () => undefined };
    const dependencies = { importBackup: implementation, now: () => Date.parse("2026-09-27T14:15:16.123Z") };
    assert.equal(await runImportBackupCli(["--input", "myexpenses-backup-20240229-140506.zip"], dependencies, io), 0);
    assert.equal(await runImportBackupCli(["--input", "source.zip"], dependencies, io), 0);
    assert.equal(received[0]?.backupFilenameTimestamp, "20240229140506");
    assert.equal(received[0]?.importedAt, "2026-09-27T14:15:16.123Z");
    assert.equal(received[1]?.backupFilenameTimestamp, undefined);
    assert.equal(received[1]?.importedAt, "2026-09-27T14:15:16.123Z");
});

test("returns failure without invoking the importer for invalid arguments", async () => {
    let calls = 0;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runImportBackupCli(
        ["--input", "backup.zip", "--input-directory", "data"],
        {
            importBackup: async () => {
                calls++;
                throw new Error("must not run");
            },
        },
        {
            stdout: (message) => stdout.push(message),
            stderr: (message) => stderr.push(message),
        },
    );

    assert.equal(exitCode, 1);
    assert.equal(calls, 0);
    assert.deepEqual(stdout, []);
    assert.match(stderr.join(""), /either --input or --input-directory/iu);
});

test("resolves the latest backup before importing without disclosing its path", async () => {
    const stdout: string[] = [];
    let received: ImportBackupOptions | undefined;
    const exitCode = await runImportBackupCli(
        [],
        {
            findLatestBackup: async (directoryPath) => {
                assert.equal(directoryPath, "data");
                return "/private/latest.zip";
            },
            importBackup: async (options) => {
                received = options;
                return {
                    accountCount: 1,
                    budgetCount: 0,
                    categoryCount: 2,
                    outputPath: options.outputPath,
                    postingCount: 3,
                };
            },
        },
        {
            stdout: (message) => stdout.push(message),
            stderr: () => undefined,
        },
    );

    assert.deepEqual(received, {
        inputPath: "/private/latest.zip",
        outputPath: "data/app-dataset.json",
        timeZone: "Europe/Madrid",
        importedAt: received?.importedAt,
    });
    assert.match(received?.importedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    assert.equal(exitCode, 0);
    assert.doesNotMatch(stdout.join(""), /private|latest\.zip/iu);
});

test("redacts unknown importer errors", async () => {
    const stderr: string[] = [];
    const exitCode = await runImportBackupCli(
        ["--input", "backup.zip"],
        {
            importBackup: async () => {
                throw new Error("private payee /home/person/backup.zip");
            },
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
