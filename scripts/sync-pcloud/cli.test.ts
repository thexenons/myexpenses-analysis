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

test("accepts only optional force, including the pnpm separator", () => {
    assert.deepEqual(parseSyncPCloudArguments([]), { force: false });
    assert.deepEqual(parseSyncPCloudArguments(["--", "--force"]), { force: true });
    assert.throws(() => parseSyncPCloudArguments(["--config", "/tmp/config.json"]));
    assert.throws(() => parseSyncPCloudArguments(["unexpected"]));
});

test("never logs unknown pipeline errors or configured secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-pcloud-cli-test-"));
    const repositoryRoot = join(root, "repository");
    const deployRoot = join(root, "deploy");
    await Promise.all([mkdir(repositoryRoot), mkdir(deployRoot)]);
    const environment = {
        PCLOUD_API_HOST: "api.pcloud.com",
        PCLOUD_FOLDER_ID: "1",
        PCLOUD_TOKEN: "secret-token",
        MYEXPENSES_VAULT_PASSPHRASE: "secret-passphrase",
        MYEXPENSES_REPOSITORY_ROOT: repositoryRoot,
        MYEXPENSES_DEPLOY_ROOT: deployRoot,
    };
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
                [],
                dependencies,
                {
                    stdout: (message) => stdout.push(message),
                    stderr: (message) => stderr.push(message),
                },
                undefined,
                { cwd: root, environment },
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

test("one-shot sync loads .env secrets, skips unchanged backups and propagates force", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-pcloud-cli-success-"));
    const repositoryRoot = join(root, "repository");
    await mkdir(repositoryRoot);
    let builds = 0;
    const output: string[] = [];
    const io = { stdout: (message: string) => output.push(message), stderr: (message: string) => output.push(message) };
    const dependencies: PCloudSyncDependencies = {
        loadSecrets: async () => { throw new Error("Legacy secret loader must not run"); },
        createClient: ({ token, apiHost }) => {
            assert.equal(token, "literal # $token");
            assert.equal(apiHost, "eapi.pcloud.com");
            return {
                listLatestBackup: async () => ({ fileId: "1", modifiedEpochSeconds: 1, name: "myexpenses-backup-20260822-210453.zip", nameTimestamp: "20260822210453", size: 4 }),
                getBackupChecksums: async (file) => ({ ...file, checksumSha1: "a".repeat(40), checksumSha256: "b".repeat(64) }),
                downloadBackup: async (_file, path) => ({ path, bytes: 4, sha1: "a".repeat(40), sha256: "b".repeat(64) }),
            };
        },
        processBackup: async ({ workspacePath, vaultPassphrase }) => {
            assert.equal(vaultPassphrase, "  literal passphrase  ");
            builds++;
            const buildDirectory = join(workspacePath, "dist");
            await mkdir(buildDirectory);
            await writeFile(join(buildDirectory, "index.html"), "test release");
            return { buildDirectory };
        },
    };
    try {
        await writeFile(join(root, ".env"), [
            "PCLOUD_API_HOST=eapi.pcloud.com",
            "PCLOUD_FOLDER_ID=1",
            'PCLOUD_TOKEN="literal # $token"',
            "MYEXPENSES_VAULT_PASSPHRASE='  literal passphrase  '",
            `MYEXPENSES_REPOSITORY_ROOT=${repositoryRoot}`,
            `MYEXPENSES_DEPLOY_ROOT=${join(root, "deploy")}`,
        ].join("\n"));
        const context = { cwd: root, environment: {} };
        assert.equal(await runSyncPCloudCli([], dependencies, io, undefined, context), 0);
        assert.equal(builds, 1);
        assert.equal(await runSyncPCloudCli([], dependencies, io, undefined, context), 0);
        assert.equal(builds, 1);
        assert.match(output.join(""), /without changes/);
        assert.equal(await runSyncPCloudCli(["--force"], dependencies, io, undefined, context), 0);
        assert.equal(builds, 2);
        assert.doesNotMatch(output.join(""), /literal|passphrase|\$token/);
        output.length = 0;
        assert.equal(await runSyncPCloudCli([], dependencies, io, undefined, {
            cwd: root, environment: { PCLOUD_TOKEN: "" },
        }), 1);
        assert.match(output.join(""), /PCLOUD_TOKEN is missing or invalid/);
        assert.equal(builds, 2);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
