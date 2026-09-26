import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runPCloudSync } from "./orchestrator.ts";
import { createStaticBuildEnvironment } from "./process-backup.ts";
import { loadSyncPCloudRuntimeConfig } from "./runtime-config.ts";

const validEnvironment = {
    PCLOUD_API_HOST: "eapi.pcloud.com",
    PCLOUD_FOLDER_ID: "90071992547409930",
    PCLOUD_TOKEN: "  $token'\"ñ  ",
    MYEXPENSES_VAULT_PASSPHRASE: "  $passphrase'\"ñ  ",
};

test("loads validated settings and exact literal secrets from memory", () => {
    const runtime = loadSyncPCloudRuntimeConfig(validEnvironment);
    assert.deepEqual(runtime.config, {
        apiHost: "eapi.pcloud.com",
        deployRoot: "/srv/myexpenses",
        folder: { folderId: "90071992547409930" },
        repositoryRoot: "/app",
        timeZone: "Europe/Madrid",
    });
    assert.deepEqual(runtime.secrets, {
        token: validEnvironment.PCLOUD_TOKEN,
        vaultPassphrase: validEnvironment.MYEXPENSES_VAULT_PASSPHRASE,
    });
    assert.doesNotMatch(JSON.stringify(runtime.config), /token|passphrase|File/iu);
});

test("accepts a folder path and validates explicit roots and time zone", () => {
    const runtime = loadSyncPCloudRuntimeConfig({
        ...validEnvironment,
        PCLOUD_FOLDER_ID: undefined,
        PCLOUD_FOLDER_PATH: "/Backups/MyExpenses",
        MYEXPENSES_DEPLOY_ROOT: "/srv/releases",
        MYEXPENSES_REPOSITORY_ROOT: "/opt/myexpenses",
        MYEXPENSES_TIME_ZONE: "America/New_York",
    });
    assert.deepEqual(runtime.config.folder, { path: "/Backups/MyExpenses" });
    assert.equal(runtime.config.deployRoot, "/srv/releases");
    assert.equal(runtime.config.repositoryRoot, "/opt/myexpenses");
    assert.equal(runtime.config.timeZone, "America/New_York");
});

test("treats an empty optional selector as absent for Compose defaults", () => {
    const byId = loadSyncPCloudRuntimeConfig({
        ...validEnvironment,
        PCLOUD_FOLDER_PATH: "",
    });
    assert.deepEqual(byId.config.folder, { folderId: "90071992547409930" });

    const byPath = loadSyncPCloudRuntimeConfig({
        ...validEnvironment,
        PCLOUD_FOLDER_ID: "",
        PCLOUD_FOLDER_PATH: "/Backups/MyExpenses",
    });
    assert.deepEqual(byPath.config.folder, { path: "/Backups/MyExpenses" });
});

test("requires the host, exactly one selector, and both secrets", () => {
    const invalid = [
        { PCLOUD_API_HOST: undefined },
        { PCLOUD_FOLDER_ID: undefined },
        { PCLOUD_FOLDER_ID: "", PCLOUD_FOLDER_PATH: "" },
        { PCLOUD_FOLDER_PATH: "/backup" },
        { PCLOUD_TOKEN: undefined },
        { MYEXPENSES_VAULT_PASSPHRASE: undefined },
    ];
    for (const patch of invalid) {
        assert.throws(() => loadSyncPCloudRuntimeConfig({ ...validEnvironment, ...patch }));
    }
});

test("rejects invalid settings and secrets without exposing supplied values", () => {
    const invalid = [
        { PCLOUD_API_HOST: "private-host.invalid" },
        { PCLOUD_FOLDER_ID: "18446744073709551616" },
        { PCLOUD_FOLDER_PATH: "/private/../$path", PCLOUD_FOLDER_ID: undefined },
        { MYEXPENSES_TIME_ZONE: "private-time-zone" },
        { MYEXPENSES_DEPLOY_ROOT: "private-relative-path" },
        { MYEXPENSES_REPOSITORY_ROOT: "/srv/myexpenses/private" },
        { PCLOUD_TOKEN: "private\ntoken" },
        { MYEXPENSES_VAULT_PASSPHRASE: "short" },
    ];
    for (const patch of invalid) {
        let error: unknown;
        try {
            loadSyncPCloudRuntimeConfig({ ...validEnvironment, ...patch });
        } catch (caught) {
            error = caught;
        }
        assert.ok(error instanceof Error, "invalid runtime environment was accepted");
        const details = String(error);
        for (const secret of Object.values(patch)) {
            if (typeof secret === "string" && secret.startsWith("private")) {
                assert.equal(details.includes(secret), false);
            }
        }
    }
});

test("build children never inherit new runtime credentials", () => {
    const environment = createStaticBuildEnvironment({
        ...validEnvironment,
        PATH: "/usr/bin",
    }, "/private/work/app-dataset.vault.json");
    assert.deepEqual(environment, {
        MYEXPENSES_VAULT_SOURCE_PATH: "/private/work/app-dataset.vault.json",
        NODE_ENV: "production",
        PATH: "/usr/bin",
    });
});

test("orchestrator accepts in-memory secrets without credential file paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-pcloud-runtime-test-"));
    const repositoryRoot = join(root, "repository");
    const deployRoot = join(root, "deploy");
    await mkdir(repositoryRoot);
    const runtime = loadSyncPCloudRuntimeConfig({
        ...validEnvironment,
        MYEXPENSES_DEPLOY_ROOT: deployRoot,
        MYEXPENSES_REPOSITORY_ROOT: repositoryRoot,
    });
    let observedToken: string | undefined;
    let loadedSecrets = false;
    try {
        await assert.rejects(
            runPCloudSync(runtime.config, {
                createClient: ({ token }) => {
                    observedToken = token;
                    return {
                        listLatestBackup: async () => {
                            throw new Error("Stopped before network access");
                        },
                        getBackupChecksums: async () => {
                            throw new Error("Unexpected checksum call");
                        },
                        downloadBackup: async () => {
                            throw new Error("Unexpected download call");
                        },
                    };
                },
                loadSecrets: async () => {
                    loadedSecrets = true;
                    return runtime.secrets;
                },
                processBackup: async () => {
                    throw new Error("Unexpected processing call");
                },
                withLock: async (_root, operation) => operation(),
            }),
            /Stopped before network access/,
        );
        assert.equal(loadedSecrets, true);
        assert.equal(observedToken, validEnvironment.PCLOUD_TOKEN);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
