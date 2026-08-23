import assert from "node:assert/strict";
import {
    chmod,
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    readlink,
    readdir,
    rm,
    symlink,
    unlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    runPCloudSync,
    type PCloudSyncClient,
    type PCloudSyncDependencies,
    type ProcessBackup,
} from "./orchestrator.ts";
import type { SyncPCloudConfig } from "./config.ts";
import type {
    PCloudBackupFile,
    PCloudVerifiedBackupFile,
} from "./pcloud.ts";

const SHA1_A = "a".repeat(40);
const SHA1_B = "b".repeat(40);
const SHA256_A = "1".repeat(64);
const SHA256_B = "2".repeat(64);

interface Fixture {
    config: SyncPCloudConfig;
    deployRoot: string;
    repositoryRoot: string;
    root: string;
}

async function fixture(): Promise<Fixture> {
    const root = await mkdtemp(join(tmpdir(), "pcloud-orchestrator-test-"));
    const deployRoot = join(root, "deploy");
    const repositoryRoot = join(root, "repository");
    await Promise.all([mkdir(deployRoot), mkdir(repositoryRoot)]);
    return {
        config: {
            apiHost: "eapi.pcloud.com",
            deployRoot,
            folder: { folderId: "10" },
            repositoryRoot,
            timeZone: "Europe/Madrid",
            tokenFile: join(root, "unused-token"),
            vaultPassphraseFile: join(root, "unused-passphrase"),
        },
        deployRoot,
        repositoryRoot,
        root,
    };
}

function selected(fileId = "100"): PCloudBackupFile {
    return {
        fileId,
        modifiedEpochSeconds: 1_787_425_493,
        name: "myexpenses-backup-20260822-210453.zip",
        nameTimestamp: "20260822210453",
        size: 4,
    };
}

function verified(
    fileId = "100",
    checksumSha1 = SHA1_A,
    checksumSha256 = SHA256_A,
): PCloudVerifiedBackupFile {
    return {
        ...selected(fileId),
        checksumSha1,
        checksumSha256,
    };
}

function fakeClient(file: PCloudVerifiedBackupFile): PCloudSyncClient {
    return {
        listLatestBackup: async () => selected(file.fileId),
        getBackupChecksums: async () => file,
        downloadBackup: async (_remote, destinationPath) => {
            await writeFile(destinationPath, "data", { mode: 0o600 });
            return {
                bytes: 4,
                path: destinationPath,
                sha1: file.checksumSha1,
                sha256: file.checksumSha256 ?? SHA256_A,
            };
        },
    };
}

function pipeline(counter: { value: number }): ProcessBackup {
    return async (input) => {
        counter.value++;
        assert.equal(input.vaultPassphrase, "passphrase");
        assert.equal(input.repositoryRoot.endsWith("repository"), true);
        assert.equal(input.timeZone, "Europe/Madrid");
        assert.equal((await lstat(input.workspacePath)).mode & 0o777, 0o700);
        const buildDirectory = join(input.workspacePath, "build");
        await mkdir(buildDirectory);
        await writeFile(join(buildDirectory, "index.html"), "release");
        return { buildDirectory };
    };
}

function dependencies(
    client: PCloudSyncClient,
    processBackup: ProcessBackup,
): PCloudSyncDependencies {
    return {
        createClient: () => client,
        loadSecrets: async () => ({
            token: "token",
            vaultPassphrase: "passphrase",
        }),
        processBackup,
    };
}

async function currentReleaseId(deployRoot: string): Promise<string | null> {
    try {
        return (await readlink(join(deployRoot, "current"))).slice(
            "releases/".length,
        );
    } catch {
        return null;
    }
}

test("publishes atomically, then no-ops by checksum identity", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const deps = dependencies(fakeClient(verified()), pipeline(count));
        const first = await runPCloudSync(value.config, deps);
        assert.equal(first.status, "published");
        assert.equal(count.value, 1);
        const releaseId = first.releaseId;
        assert.equal(await currentReleaseId(value.deployRoot), releaseId);
        assert.equal(
            await readFile(
                join(value.deployRoot, "releases", releaseId, "index.html"),
                "utf8",
            ),
            "release",
        );
        assert.equal(
            (await lstat(join(value.deployRoot, ".sync-state.json"))).mode &
                0o777,
            0o600,
        );
        const second = await runPCloudSync(value.config, deps);
        assert.deepEqual(second, {
            status: "noop",
            fileId: "100",
            releaseId,
        });
        assert.equal(count.value, 1);
        assert.equal(
            (await readdir(join(value.deployRoot, "releases"))).length,
            1,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("force processes again and retains the previous release", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const deps = dependencies(fakeClient(verified()), pipeline(count));
        const first = await runPCloudSync(value.config, deps);
        const forced = await runPCloudSync(value.config, {
            ...deps,
            now: () => 1_800_000_000_123,
        }, { force: true });
        assert.equal(forced.status, "published");
        assert.notEqual(forced.releaseId, first.releaseId);
        assert.equal(count.value, 2);
        assert.equal(await currentReleaseId(value.deployRoot), forced.releaseId);
        const releases = await readdir(join(value.deployRoot, "releases"));
        assert.equal(releases.includes(first.releaseId), true);
        assert.equal(releases.includes(forced.releaseId), true);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("pipeline failure leaves current release and state untouched", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const first = await runPCloudSync(
            value.config,
            dependencies(fakeClient(verified()), pipeline(count)),
        );
        const stateBefore = await readFile(
            join(value.deployRoot, ".sync-state.json"),
        );
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(
                    fakeClient(verified("101", SHA1_B, SHA256_B)),
                    async () => {
                        throw new Error("private pipeline detail");
                    },
                ),
            ),
            /private pipeline detail/,
        );
        assert.equal(await currentReleaseId(value.deployRoot), first.releaseId);
        assert.deepEqual(
            await readFile(join(value.deployRoot, ".sync-state.json")),
            stateBefore,
        );
        assert.equal(
            (await readdir(join(value.deployRoot, "releases"))).length,
            1,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("state failure rolls back current while retaining both releases", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const first = await runPCloudSync(
            value.config,
            dependencies(fakeClient(verified()), pipeline(count)),
        );
        const stateBefore = await readFile(
            join(value.deployRoot, ".sync-state.json"),
        );
        await assert.rejects(
            runPCloudSync(value.config, {
                ...dependencies(
                    fakeClient(verified("101", SHA1_B, SHA256_B)),
                    pipeline(count),
                ),
                writeState: async () => {
                    throw new Error("state storage unavailable");
                },
            }),
            /state could not be committed/iu,
        );
        assert.equal(await currentReleaseId(value.deployRoot), first.releaseId);
        assert.deepEqual(
            await readFile(join(value.deployRoot, ".sync-state.json")),
            stateBefore,
        );
        assert.equal(
            (await readdir(join(value.deployRoot, "releases"))).length,
            2,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects escaped pipeline output without state or current swap", async () => {
    const value = await fixture();
    const outside = join(value.root, "outside-build");
    await mkdir(outside);
    try {
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), async () => ({
                    buildDirectory: outside,
                })),
            ),
            /escapes the private workspace/iu,
        );
        assert.equal(await currentReleaseId(value.deployRoot), null);
        await assert.rejects(
            readFile(join(value.deployRoot, ".sync-state.json")),
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects symbolic links anywhere in pipeline output", async () => {
    const value = await fixture();
    const outside = join(value.root, "outside.txt");
    await writeFile(outside, "must-not-be-published");
    try {
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), async (input) => {
                    const buildDirectory = join(input.workspacePath, "build");
                    await mkdir(buildDirectory);
                    await symlink(outside, join(buildDirectory, "leak.txt"));
                    return { buildDirectory };
                }),
            ),
            /must not contain symbolic links/iu,
        );
        assert.equal(await currentReleaseId(value.deployRoot), null);
        assert.deepEqual(await readdir(join(value.deployRoot, "releases")), []);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects known plaintext backup artifacts anywhere in the release", async () => {
    const value = await fixture();
    try {
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), async (input) => {
                    const buildDirectory = join(input.workspacePath, "build");
                    const nested = join(buildDirectory, "assets", "unexpected");
                    await mkdir(nested, { recursive: true });
                    await writeFile(
                        join(nested, "app-dataset.json"),
                        "private plaintext",
                    );
                    return { buildDirectory };
                }),
            ),
            /forbidden plaintext artifact/iu,
        );
        assert.equal(await currentReleaseId(value.deployRoot), null);
        assert.deepEqual(await readdir(join(value.deployRoot, "releases")), []);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rebuilds a dangling current release instead of reporting a no-op", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const deps = dependencies(fakeClient(verified()), pipeline(count));
        const first = await runPCloudSync(value.config, deps);
        await rm(join(value.deployRoot, "releases", first.releaseId), {
            force: true,
            recursive: true,
        });

        const recovered = await runPCloudSync(value.config, deps);
        assert.equal(recovered.status, "published");
        assert.equal(count.value, 2);
        assert.equal(await currentReleaseId(value.deployRoot), recovered.releaseId);
        assert.equal(
            await readFile(
                join(
                    value.deployRoot,
                    "releases",
                    recovered.releaseId,
                    "index.html",
                ),
                "utf8",
            ),
            "release",
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("uses a recovery release id when state and current diverge", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const deps = dependencies(fakeClient(verified()), pipeline(count));
        const first = await runPCloudSync(value.config, deps);
        const alternate = "manual-safe-release";
        await mkdir(join(value.deployRoot, "releases", alternate));
        await unlink(join(value.deployRoot, "current"));
        await symlink(`releases/${alternate}`, join(value.deployRoot, "current"));

        const recovered = await runPCloudSync(value.config, deps);
        assert.equal(recovered.status, "published");
        assert.notEqual(recovered.releaseId, first.releaseId);
        assert.notEqual(recovered.releaseId, alternate);
        assert.equal(count.value, 2);
        assert.equal(await currentReleaseId(value.deployRoot), recovered.releaseId);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects deployment roots that overlap after resolving ancestors", async () => {
    const value = await fixture();
    const realParent = join(value.root, "real-parent");
    const aliasParent = join(value.root, "alias-parent");
    const deployRoot = join(aliasParent, "deploy");
    const nestedRepository = join(realParent, "deploy", "repository");
    await mkdir(nestedRepository, { recursive: true });
    await symlink(realParent, aliasParent, "dir");
    try {
        await assert.rejects(
            runPCloudSync(
                {
                    ...value.config,
                    deployRoot,
                    repositoryRoot: nestedRepository,
                },
                dependencies(fakeClient(verified()), pipeline({ value: 0 })),
            ),
            /resolve to overlapping directory trees/iu,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects deployment directories writable by other principals", async () => {
    const value = await fixture();
    try {
        await chmod(value.deployRoot, 0o777);
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), pipeline({ value: 0 })),
            ),
            /deployment root.*unsafe ownership or permissions/iu,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("removes a private workspace left by a crashed previous run", async () => {
    const value = await fixture();
    const staleWorkspace = join(value.deployRoot, ".work", "sync-AbC123");
    try {
        await mkdir(staleWorkspace, { recursive: true, mode: 0o700 });
        await writeFile(join(staleWorkspace, "source.zip"), "private backup", {
            mode: 0o600,
        });
        const result = await runPCloudSync(
            value.config,
            dependencies(fakeClient(verified()), pipeline({ value: 0 })),
        );
        assert.equal(result.status, "published");
        assert.deepEqual(await readdir(join(value.deployRoot, ".work")), []);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("does not follow a symlink disguised as a stale workspace", async () => {
    const value = await fixture();
    const outside = join(value.root, "outside-workspace");
    try {
        await mkdir(join(value.deployRoot, ".work"), {
            recursive: true,
            mode: 0o700,
        });
        await mkdir(outside);
        await writeFile(join(outside, "keep.txt"), "keep");
        await symlink(
            outside,
            join(value.deployRoot, ".work", "sync-AbC123"),
            "dir",
        );
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), pipeline({ value: 0 })),
            ),
            /stale workspace has unsafe/iu,
        );
        assert.equal(await readFile(join(outside, "keep.txt"), "utf8"), "keep");
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("recovers a private lock owned by a dead PID", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const lock = join(value.deployRoot, ".sync.lock");
        await writeFile(lock, "2147483647\n", { mode: 0o600 });
        const result = await runPCloudSync(
            value.config,
            dependencies(fakeClient(verified()), pipeline(count)),
        );
        assert.equal(result.status, "published");
        await assert.rejects(lstat(lock));
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("refuses a lock owned by a live process", async () => {
    const value = await fixture();
    try {
        const lock = join(value.deployRoot, ".sync.lock");
        await writeFile(lock, `${process.pid}\n`, { mode: 0o600 });
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), pipeline({ value: 0 })),
            ),
            /synchronization is active/iu,
        );
        assert.equal(await readFile(lock, "utf8"), `${process.pid}\n`);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("publishes a complete private PID lock before entering the operation", async () => {
    const value = await fixture();
    try {
        const result = await runPCloudSync(
            value.config,
            dependencies(fakeClient(verified()), async (input) => {
                const lock = join(value.deployRoot, ".sync.lock");
                assert.equal(await readFile(lock, "utf8"), `${process.pid}\n`);
                assert.equal((await lstat(lock)).mode & 0o777, 0o600);
                return pipeline({ value: 0 })(input);
            }),
        );
        assert.equal(result.status, "published");
        await assert.rejects(lstat(join(value.deployRoot, ".sync.lock")));
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});
