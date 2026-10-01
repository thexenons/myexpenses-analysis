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

import { acquireSyncLease } from "./lease.ts";
import {
    acknowledgePendingNotification,
    peekPendingNotification,
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
        assert.equal(input.backupFilenameTimestamp, "20260822210453");
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

async function publishForced(
    value: Fixture,
    sequence: number,
    overrides: Partial<PCloudSyncDependencies> = {},
) {
    return runPCloudSync(value.config, {
        ...dependencies(fakeClient(verified()), pipeline({ value: 0 })),
        now: () => 1_800_000_000_000 + sequence,
        ...overrides,
    }, { force: true });
}

test("retains five managed releases including an older previous current target", async () => {
    const value = await fixture();
    try {
        const ids: string[] = [];
        for (let sequence = 0; sequence < 5; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- serial publications exercise the same lease and retention history.
            ids.push((await publishForced(value, sequence)).releaseId);
        }
        await unlink(join(value.deployRoot, "current"));
        await symlink(`releases/${ids[0]}`, join(value.deployRoot, "current"));
        const newest = (await publishForced(value, 5)).releaseId;
        assert.deepEqual(
            (await readdir(join(value.deployRoot, "releases"))).sort(),
            [ids[0], ...ids.slice(2), newest].sort(),
        );
        assert.equal(await currentReleaseId(value.deployRoot), newest);
        const marker = JSON.parse(await readFile(
            join(value.deployRoot, "releases", newest, ".sync-release.json"), "utf8",
        ));
        assert.deepEqual(Object.keys(marker).sort(), ["createdAt", "releaseId", "version"]);
        assert.deepEqual(marker, { version: 1, releaseId: newest, createdAt: 1_800_000_000_005 });
        assert.equal((await lstat(join(value.deployRoot, "releases", newest, ".sync-release.json"))).mode & 0o777, 0o600);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("retention preserves legacy, foreign, malformed, and symlinked release entries", async () => {
    const value = await fixture();
    const outside = join(value.root, "outside");
    try {
        await mkdir(outside);
        await writeFile(join(outside, "sentinel"), "keep");
        await mkdir(join(value.deployRoot, "releases"));
        await mkdir(join(value.deployRoot, "releases", "legacy-release"));
        await mkdir(join(value.deployRoot, "releases", "foreign-release"));
        await writeFile(join(value.deployRoot, "releases", "foreign-release", ".sync-release.json"), "{}", { mode: 0o600 });
        const malformedId = "b20260822210453-f998-caaaaaaaaaaaa";
        const symlinkedMarkerId = "b20260822210453-f999-caaaaaaaaaaaa";
        await mkdir(join(value.deployRoot, "releases", malformedId));
        await writeFile(join(value.deployRoot, "releases", malformedId, ".sync-release.json"),
            JSON.stringify({ version: 1, releaseId: "wrong", createdAt: 1 }), { mode: 0o600 });
        await mkdir(join(value.deployRoot, "releases", symlinkedMarkerId));
        await symlink(join(outside, "sentinel"),
            join(value.deployRoot, "releases", symlinkedMarkerId, ".sync-release.json"));
        await symlink(outside, join(value.deployRoot, "releases", "symlink-release"));
        for (let sequence = 0; sequence < 7; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- history must accumulate sequentially.
            await publishForced(value, sequence);
        }
        const names = await readdir(join(value.deployRoot, "releases"));
        assert.equal(names.length, 10);
        for (const name of ["legacy-release", "foreign-release", malformedId, symlinkedMarkerId, "symlink-release"]) {
            assert.equal(names.includes(name), true);
        }
        assert.equal(await readFile(join(outside, "sentinel"), "utf8"), "keep");
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("failed state commit never prunes older managed releases", async () => {
    const value = await fixture();
    try {
        for (let sequence = 0; sequence < 5; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- create the serial history before the failed commit.
            await publishForced(value, sequence);
        }
        const before = await readdir(join(value.deployRoot, "releases"));
        await assert.rejects(publishForced(value, 5, {
            writeState: async () => { throw new Error("injected failure"); },
        }), /state could not be committed/iu);
        const after = await readdir(join(value.deployRoot, "releases"));
        assert.equal(before.every((name) => after.includes(name)), true);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("retention skips cleanup if committed state and current disagree", async () => {
    const value = await fixture();
    try {
        for (let sequence = 0; sequence < 5; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- create serial managed releases.
            await publishForced(value, sequence);
        }
        const before = await readdir(join(value.deployRoot, "releases"));
        await publishForced(value, 5, {
            writeState: async (root, state) => {
                await writeFile(join(root, ".sync-state.json"), JSON.stringify(state), { mode: 0o600 });
                await unlink(join(root, "current"));
                await symlink(`releases/${before[0]}`, join(root, "current"));
            },
        });
        assert.equal((await readdir(join(value.deployRoot, "releases"))).length, 6);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("retention deletion failure is nonfatal after a successful state commit", async () => {
    const value = await fixture();
    const logs: string[] = [];
    try {
        for (let sequence = 0; sequence < 5; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- create serial managed releases.
            await publishForced(value, sequence);
        }
        const result = await publishForced(value, 5, {
            logger: { info: (message) => logs.push(message) },
            removeReleaseDirectory: async () => { throw new Error("private filesystem detail"); },
        });
        assert.equal(result.status, "published");
        assert.equal(await currentReleaseId(value.deployRoot), result.releaseId);
        assert.equal((await readdir(join(value.deployRoot, "releases"))).length, 6);
        assert.equal(logs.some((message) => /retention/u.test(message)), true);
        assert.equal(logs.some((message) => /private filesystem detail/u.test(message)), false);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("app replaces a forged build marker before promoting the release", async () => {
    const value = await fixture();
    try {
        const result = await runPCloudSync(value.config, dependencies(
            fakeClient(verified()),
            async (input) => {
                const buildDirectory = join(input.workspacePath, "build");
                await mkdir(buildDirectory);
                await writeFile(join(buildDirectory, "index.html"), "release");
                await writeFile(join(buildDirectory, ".sync-release.json"), JSON.stringify({
                    version: 1, releaseId: "forged", createdAt: 0,
                }));
                return { buildDirectory };
            },
        ));
        const marker = JSON.parse(await readFile(join(
            value.deployRoot, "releases", result.releaseId, ".sync-release.json",
        ), "utf8"));
        assert.equal(marker.releaseId, result.releaseId);
        assert.notEqual(marker.createdAt, 0);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("unsafe releases parent skips retention without undoing publication", async () => {
    const value = await fixture();
    try {
        for (let sequence = 0; sequence < 5; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- create serial managed releases.
            await publishForced(value, sequence);
        }
        const result = await publishForced(value, 5, {
            writeState: async (root, state) => {
                await writeFile(join(root, ".sync-state.json"), JSON.stringify(state), { mode: 0o600 });
                await chmod(join(root, "releases"), 0o777);
            },
        });
        assert.equal(result.status, "published");
        assert.equal((await readdir(join(value.deployRoot, "releases"))).length, 6);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("retention leaves a managed release with a later-added symlink untouched", async () => {
    const value = await fixture();
    const outside = join(value.root, "outside.txt");
    try {
        await writeFile(outside, "keep");
        const ids: string[] = [];
        for (let sequence = 0; sequence < 5; sequence++) {
            // oxlint-disable-next-line no-await-in-loop -- create serial managed releases.
            ids.push((await publishForced(value, sequence)).releaseId);
        }
        await symlink(outside, join(value.deployRoot, "releases", ids[0]!, "manual-link"));
        await publishForced(value, 5);
        assert.equal((await readdir(join(value.deployRoot, "releases"))).includes(ids[0]!), true);
        assert.equal(await readFile(outside, "utf8"), "keep");
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

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
            modifiedEpochSeconds: 1_787_425_493,
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

test("notification ledger starts on first enabled processing and counts new backups without forced duplicates", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        await runPCloudSync(value.config, dependencies(fakeClient(verified()), pipeline(count)));
        const legacy = JSON.parse(await readFile(join(value.deployRoot, ".sync-state.json"), "utf8"));
        assert.equal(Object.hasOwn(legacy, "notifications"), false);
        const first = dependencies(fakeClient(verified()), pipeline(count));
        await runPCloudSync(value.config, first, { force: true, notificationsEnabled: true });
        await runPCloudSync(value.config, first, { force: true, notificationsEnabled: true });
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified("101", SHA1_B, SHA256_B)), pipeline(count),
        ), { notificationsEnabled: true });
        const lease = await acquireSyncLease(value.deployRoot);
        try {
            assert.equal(await peekPendingNotification(value.deployRoot, lease), "1");
            await acknowledgePendingNotification(value.deployRoot, lease, "1");
            assert.equal(await peekPendingNotification(value.deployRoot, lease), "2");
            await acknowledgePendingNotification(value.deployRoot, lease, "2");
            assert.equal(await peekPendingNotification(value.deployRoot, lease), null);
        } finally {
            await lease.close();
        }
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified("102", SHA1_A, SHA256_A)), pipeline(count),
        ));
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified("102", SHA1_A, SHA256_A)), pipeline(count),
        ), { force: true, notificationsEnabled: true });
        const after = JSON.parse(await readFile(join(value.deployRoot, ".sync-state.json"), "utf8"));
        assert.equal(after.notifications.enqueued, "3");
        assert.equal(after.notifications.acknowledged, "2");
        assert.equal(count.value, 6);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("failed processing and state commit cannot enqueue a notification", async () => {
    const value = await fixture();
    try {
        await assert.rejects(runPCloudSync(value.config, dependencies(
            fakeClient(verified()), async () => { throw new Error("pipeline failed"); },
        ), { notificationsEnabled: true }), /pipeline failed/u);
        await assert.rejects(readFile(join(value.deployRoot, ".sync-state.json")));
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified()), pipeline({ value: 0 }),
        ), { notificationsEnabled: true });
        const before = await readFile(join(value.deployRoot, ".sync-state.json"));
        await assert.rejects(runPCloudSync(value.config, {
            ...dependencies(fakeClient(verified("101", SHA1_B, SHA256_B)), pipeline({ value: 0 })),
            writeState: async () => { throw new Error("cannot persist"); },
        }, { notificationsEnabled: true }), /state could not be committed/iu);
        assert.deepEqual(await readFile(join(value.deployRoot, ".sync-state.json")), before);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("notification counters remain exact beyond Number.MAX_SAFE_INTEGER", async () => {
    const value = await fixture();
    try {
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified()), pipeline({ value: 0 }),
        ), { notificationsEnabled: true });
        const path = join(value.deployRoot, ".sync-state.json");
        const state = JSON.parse(await readFile(path, "utf8"));
        state.notifications.enqueued = "9007199254740993";
        state.notifications.acknowledged = "9007199254740992";
        await writeFile(path, JSON.stringify(state));
        const lease = await acquireSyncLease(value.deployRoot);
        try {
            assert.equal(await peekPendingNotification(value.deployRoot, lease), "9007199254740993");
            await acknowledgePendingNotification(value.deployRoot, lease, "9007199254740993");
            assert.equal(await peekPendingNotification(value.deployRoot, lease), null);
        } finally {
            await lease.close();
        }
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified("101", SHA1_B, SHA256_B)), pipeline({ value: 0 }),
        ), { notificationsEnabled: true });
        const updated = JSON.parse(await readFile(path, "utf8"));
        assert.equal(updated.notifications.enqueued, "9007199254740994");
        assert.equal(updated.notifications.acknowledged, "9007199254740993");
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("notification acknowledgements reject noncanonical input without changing state", async () => {
    const value = await fixture();
    try {
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified()), pipeline({ value: 0 }),
        ), { notificationsEnabled: true });
        const statePath = join(value.deployRoot, ".sync-state.json");
        const before = await readFile(statePath);
        const lease = await acquireSyncLease(value.deployRoot);
        try {
            for (const sequence of ["1\n", "1\r", "1\u2028", "1\u2029", "01", "1 "]) {
                // oxlint-disable-next-line no-await-in-loop -- each rejected acknowledgement must leave the same durable state.
                await assert.rejects(
                    acknowledgePendingNotification(value.deployRoot, lease, sequence),
                    /acknowledgement is invalid/iu,
                );
                // oxlint-disable-next-line no-await-in-loop -- verify no invalid input was persisted.
                assert.deepEqual(await readFile(statePath), before);
            }
            assert.equal(await peekPendingNotification(value.deployRoot, lease), "1");
        } finally {
            await lease.close();
        }
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("notification state rejects malformed counters and identity before delivery", async () => {
    const value = await fixture();
    try {
        await runPCloudSync(value.config, dependencies(
            fakeClient(verified()), pipeline({ value: 0 }),
        ), { notificationsEnabled: true });
        const statePath = join(value.deployRoot, ".sync-state.json");
        const original = JSON.parse(await readFile(statePath, "utf8"));
        const lease = await acquireSyncLease(value.deployRoot);
        try {
            const corruptions = [
                { enqueued: "1\n" },
                { enqueued: "1\u2028" },
                { acknowledged: "0\r" },
                { acknowledged: "0\u2029" },
                { enqueued: "01" },
                { lastEnqueuedIdentity: original.notifications.lastEnqueuedIdentity + "\n" },
                { lastEnqueuedIdentity: original.notifications.lastEnqueuedIdentity + "\u2028" },
            ];
            for (const corruption of corruptions) {
                // oxlint-disable-next-line no-await-in-loop -- each independent state fixture is checked in sequence.
                await writeFile(statePath, JSON.stringify({
                    ...original,
                    notifications: { ...original.notifications, ...corruption },
                }));
                // oxlint-disable-next-line no-await-in-loop -- state parsing must fail closed before notification delivery.
                await assert.rejects(
                    peekPendingNotification(value.deployRoot, lease),
                    /synchronization state is invalid/iu,
                );
            }
        } finally {
            await lease.close();
        }
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

test("refuses legacy PID locks until old writers are stopped and migrated", async () => {
    const value = await fixture();
    const count = { value: 0 };
    try {
        const lock = join(value.deployRoot, ".sync.lock");
        await writeFile(lock, "2147483647\n", { mode: 0o600 });
        await assert.rejects(
            runPCloudSync(
                value.config,
                dependencies(fakeClient(verified()), pipeline(count)),
            ),
            /unsafe metadata/iu,
        );
        assert.equal(count.value, 0);
        assert.equal((await lstat(lock)).isFile(), true);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("refuses a kernel lease held by another writer", async () => {
    const value = await fixture();
    try {
        const lock = join(value.deployRoot, ".sync.lock");
        const lease = await acquireSyncLease(value.deployRoot);
        try {
            await assert.rejects(
                runPCloudSync(
                    value.config,
                    dependencies(fakeClient(verified()), pipeline({ value: 0 })),
                ),
                /synchronization is active/iu,
            );
        } finally {
            await lease.close();
        }
        assert.equal((await lstat(lock)).isFile(), true);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("holds a private kernel lease through publication", async () => {
    const value = await fixture();
    try {
        const result = await runPCloudSync(
            value.config,
            dependencies(fakeClient(verified()), async (input) => {
                const lock = join(value.deployRoot, ".sync.lock");
                assert.equal((await lstat(lock)).mode & 0o777, 0o600);
                await assert.rejects(acquireSyncLease(value.deployRoot), /active/iu);
                return pipeline({ value: 0 })(input);
            }),
        );
        assert.equal(result.status, "published");
        assert.equal((await lstat(join(value.deployRoot, ".sync.lock"))).isFile(), true);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});
