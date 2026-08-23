import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    parseSyncPCloudArguments,
    runSyncPCloudCli,
} from "./cli.ts";
import type { PCloudSyncDependencies } from "./orchestrator.ts";

test("parses only an absolute config path and optional force", () => {
    assert.deepEqual(
        parseSyncPCloudArguments([
            "--config",
            "/etc/myexpenses/sync-pcloud.json",
            "--force",
        ]),
        {
            configPath: "/etc/myexpenses/sync-pcloud.json",
            force: true,
        },
    );
    assert.throws(
        () => parseSyncPCloudArguments(["--config", "relative.json"]),
        /absolute path/iu,
    );
    assert.throws(() => parseSyncPCloudArguments([]), /--config/iu);
});

test("never logs unknown pipeline errors or configured secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-pcloud-cli-test-"));
    const repositoryRoot = join(root, "repository");
    const deployRoot = join(root, "deploy");
    const tokenFile = join(root, "token");
    const vaultPassphraseFile = join(root, "passphrase");
    const configPath = join(root, "config.json");
    await Promise.all([
        mkdir(repositoryRoot),
        mkdir(deployRoot),
        writeFile(tokenFile, "secret-token", { mode: 0o600 }),
        writeFile(vaultPassphraseFile, "secret-passphrase", { mode: 0o600 }),
    ]);
    await writeFile(
        configPath,
        JSON.stringify({
            apiHost: "api.pcloud.com",
            folderId: "1",
            tokenFile,
            vaultPassphraseFile,
            deployRoot,
            repositoryRoot,
            timeZone: "Europe/Madrid",
        }),
    );
    const dependencies: PCloudSyncDependencies = {
        createClient: () => ({
            listLatestBackup: async () => ({
                fileId: "1",
                modifiedEpochSeconds: 1,
                name: "myexpenses-backup-20260822-210453.zip",
                nameTimestamp: "20260822210453",
                size: 4,
            }),
            getBackupChecksums: async (file) => ({
                ...file,
                checksumSha1: "a".repeat(40),
                checksumSha256: "b".repeat(64),
            }),
            downloadBackup: async (_file, path) => ({
                bytes: 4,
                path,
                sha1: "a".repeat(40),
                sha256: "b".repeat(64),
            }),
        }),
        processBackup: async () => {
            throw new Error(
                "secret-token secret-passphrase https://c1.pcloud.com/file?key=private",
            );
        },
    };
    const stdout: string[] = [];
    const stderr: string[] = [];
    try {
        assert.equal(
            await runSyncPCloudCli(
                ["--config", configPath],
                dependencies,
                {
                    stdout: (message) => stdout.push(message),
                    stderr: (message) => stderr.push(message),
                },
            ),
            1,
        );
        const output = [...stdout, ...stderr].join("");
        assert.match(output, /pipeline failed/iu);
        assert.doesNotMatch(
            output,
            /secret-token|secret-passphrase|pcloud\.com\/file|key=private/iu,
        );
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});
