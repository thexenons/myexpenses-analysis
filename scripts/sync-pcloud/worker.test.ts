import assert from "node:assert/strict";
import { access, chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { acquireSyncLease } from "./lease.ts";
import { runPCloudSync } from "./orchestrator.ts";
import { runSyncPCloudWorker } from "./worker.ts";

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "sync-worker-test-"));
    const repositoryRoot = join(root, "repository");
    const deployRoot = join(root, "deploy");
    await mkdir(repositoryRoot);
    return {
        root,
        deployRoot,
        readyPath: join(root, "ready"),
        environment: {
            PCLOUD_API_HOST: "eapi.pcloud.com",
            PCLOUD_FOLDER_ID: "42",
            PCLOUD_TOKEN: "fixture-token",
            MYEXPENSES_VAULT_PASSPHRASE: "fixture-passphrase",
            MYEXPENSES_DEPLOY_ROOT: deployRoot,
            MYEXPENSES_REPOSITORY_ROOT: repositoryRoot,
        },
    };
}

const exists = async (path: string) => access(path).then(() => true, () => false);
const statusPath = (deployRoot: string) => join(deployRoot, ".sync-status.json");
const readStatus = async (deployRoot: string) => JSON.parse(
    await readFile(statusPath(deployRoot), "utf8"),
) as Record<string, number | null>;

test("published bootstrap and unchanged poll record distinct freshness evidence", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    let calls = 0;
    let first!: Record<string, number | null>;
    try {
        await runSyncPCloudWorker(value.environment, {
            intervalMs: 10, readinessPath: value.readyPath, signal: controller.signal,
            sync: async () => {
                calls++;
                if (calls === 1) return {
                    status: "published" as const, fileId: "123", releaseId: "release-a",
                    sha256: "secret", modifiedEpochSeconds: 1_700_000_000,
                };
                first = await readStatus(value.deployRoot);
                controller.abort();
                return {
                    status: "noop" as const, fileId: "123", releaseId: "release-a",
                    modifiedEpochSeconds: 1_700_000_000,
                };
            },
        });
        const last = await readStatus(value.deployRoot);
        assert.equal(last.version, 1);
        assert.ok(typeof first!.lastAttemptEpochMs === "number");
        assert.ok(typeof first!.lastSuccessfulCheckEpochMs === "number");
        assert.ok(typeof first!.lastPublicationConfirmedEpochMs === "number");
        assert.equal(first!.consecutiveFailures, 0);
        assert.ok(last.lastSuccessfulCheckEpochMs! > first!.lastSuccessfulCheckEpochMs!);
        assert.equal(last.lastPublicationConfirmedEpochMs, first!.lastPublicationConfirmedEpochMs);
        assert.equal(last.lastObservedSourceModifiedEpochSeconds, 1_700_000_000);
        assert.equal(last.consecutiveFailures, 0);
        assert.doesNotMatch(JSON.stringify(last), /secret|fileId|releaseId/iu);
        assert.equal((await lstat(statusPath(value.deployRoot))).mode & 0o777, 0o600);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("failed poll preserves availability and verified history; restart preserves that history", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    let calls = 0;
    try {
        await runSyncPCloudWorker(value.environment, {
            intervalMs: 10, readinessPath: value.readyPath, signal: controller.signal,
            sync: async () => {
                calls++;
                if (calls === 1) return {
                    status: "published" as const, fileId: "1", releaseId: "release-a",
                    sha256: "secret", modifiedEpochSeconds: 1_600_000_000,
                };
                if (calls === 2) throw new Error("private token path");
                assert.equal(await exists(value.readyPath), true);
                const failed = await readStatus(value.deployRoot);
                assert.equal(failed.consecutiveFailures, 1);
                assert.equal(failed.lastObservedSourceModifiedEpochSeconds, 1_600_000_000);
                assert.ok(typeof failed.lastPublicationConfirmedEpochMs === "number");
                controller.abort();
                return {
                    status: "noop" as const, fileId: "1", releaseId: "release-a",
                    modifiedEpochSeconds: 1_600_000_000,
                };
            },
        });
        const restarted = new AbortController();
        const before = await readStatus(value.deployRoot);
        assert.equal(before.consecutiveFailures, 0);
        await runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath, signal: restarted.signal,
            sync: async () => { restarted.abort(); },
        });
        const after = await readStatus(value.deployRoot);
        assert.equal(after.lastPublicationConfirmedEpochMs, before.lastPublicationConfirmedEpochMs);
        assert.equal(after.lastObservedSourceModifiedEpochSeconds, before.lastObservedSourceModifiedEpochSeconds);
        assert.equal(after.consecutiveFailures, 0);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("failed bootstrap records failure without readiness or secret-bearing status", async () => {
    const value = await fixture();
    try {
        await assert.rejects(runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            sync: async () => { throw new Error("private token path"); },
        }), /bootstrap failed/iu);
        const status = await readStatus(value.deployRoot);
        assert.equal(status.consecutiveFailures, 1);
        assert.equal(status.lastSuccessfulCheckEpochMs, null);
        assert.equal(status.lastPublicationConfirmedEpochMs, null);
        assert.equal(await exists(value.readyPath), false);
        assert.doesNotMatch(JSON.stringify(status), /private|token|path/iu);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("malformed private status recovers, but a symlink cannot be replaced", async () => {
    const value = await fixture();
    const controller = new AbortController();
    const messages: string[] = [];
    try {
        await mkdir(value.deployRoot);
        await writeFile(statusPath(value.deployRoot), "{broken", { mode: 0o600 });
        await runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath, signal: controller.signal,
            logger: { info: (message) => messages.push(message) },
            sync: async () => { controller.abort(); },
        });
        assert.equal((await readStatus(value.deployRoot)).consecutiveFailures, 0);
        await rm(statusPath(value.deployRoot));
        const target = join(value.root, "target");
        await writeFile(target, "sentinel");
        await symlink(target, statusPath(value.deployRoot));
        const second = new AbortController();
        let readyWhileStatusUnsafe = false;
        await runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath, signal: second.signal,
            logger: { info: (message) => messages.push(message) },
            sync: async () => {
                void (async () => {
                    for (let attempt = 0; attempt < 100; attempt++) {
                        // oxlint-disable-next-line no-await-in-loop -- readiness is created after bootstrap returns.
                        if (await exists(value.readyPath)) {
                            readyWhileStatusUnsafe = true;
                            break;
                        }
                        // oxlint-disable-next-line no-await-in-loop -- bounded readiness probe in a test.
                        await new Promise((resolve) => setTimeout(resolve, 5));
                    }
                    second.abort();
                })();
            },
        });
        assert.equal(readyWhileStatusUnsafe, true);
        assert.equal(await readFile(target, "utf8"), "sentinel");
        assert.equal((await lstat(statusPath(value.deployRoot))).isSymbolicLink(), true);
        assert.ok(messages.some((message) => message.includes("status")));
        assert.doesNotMatch(messages.join(" "), /target|broken|sentinel/iu);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("unsafe status permissions are not trusted or overwritten", async () => {
    const value = await fixture();
    const controller = new AbortController();
    try {
        await mkdir(value.deployRoot);
        await writeFile(statusPath(value.deployRoot), "{}", { mode: 0o600 });
        await chmod(statusPath(value.deployRoot), 0o644);
        await runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath, signal: controller.signal,
            sync: async () => { controller.abort(); },
        });
        assert.equal(await readFile(statusPath(value.deployRoot), "utf8"), "{}");
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("unrecognized status fields cannot import forged history or leak into replacement", async () => {
    const value = await fixture();
    const controller = new AbortController();
    try {
        await mkdir(value.deployRoot);
        await writeFile(statusPath(value.deployRoot), JSON.stringify({
            version: 1, lastAttemptEpochMs: 11, lastSuccessfulCheckEpochMs: 11,
            lastPublicationConfirmedEpochMs: 11, consecutiveFailures: 0,
            lastObservedSourceModifiedEpochSeconds: 11, secret: "private-token",
        }), { mode: 0o600 });
        await runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath, signal: controller.signal,
            sync: async () => { controller.abort(); },
        });
        const status = await readStatus(value.deployRoot);
        assert.equal(status.lastPublicationConfirmedEpochMs, null);
        assert.equal(status.lastObservedSourceModifiedEpochSeconds, null);
        assert.doesNotMatch(JSON.stringify(status), /secret|private-token/iu);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("shutdown cancellation is not a failed sync cycle", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    let checkedAt: number | null = null;
    try {
        await runSyncPCloudWorker(value.environment, {
            intervalMs: 10, readinessPath: value.readyPath, signal: controller.signal,
            sync: async (force, signal) => {
                if (force) return;
                checkedAt = (await readStatus(value.deployRoot)).lastSuccessfulCheckEpochMs ?? null;
                controller.abort();
                signal.throwIfAborted();
            },
        });
        const status = await readStatus(value.deployRoot);
        assert.equal(status.consecutiveFailures, 0);
        assert.equal(status.lastSuccessfulCheckEpochMs, checkedAt);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("bootstrap is forced once; readiness follows success; periodic work is serial", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    const calls: boolean[] = [];
    let signalBootstrapStarted!: () => void;
    const bootstrapStarted = new Promise<void>((resolve) => { signalBootstrapStarted = resolve; });
    let releaseBootstrap!: () => void;
    const bootstrap = new Promise<void>((resolve) => { releaseBootstrap = resolve; });
    let signalPeriodicStarted!: () => void;
    const periodicStarted = new Promise<void>((resolve) => { signalPeriodicStarted = resolve; });
    let releasePeriodic!: () => void;
    const periodic = new Promise<void>((resolve) => { releasePeriodic = resolve; });
    try {
        const running = runSyncPCloudWorker(value.environment, {
            intervalMs: 10,
            readinessPath: value.readyPath,
            signal: controller.signal,
            timeoutMs: 1_000,
            sync: async (force) => {
                calls.push(force);
                if (calls.length === 1) {
                    signalBootstrapStarted();
                    await bootstrap;
                }
                if (calls.length === 2) {
                    signalPeriodicStarted();
                    await periodic;
                }
            },
        });
        await bootstrapStarted;
        assert.deepEqual(calls, [true]);
        assert.equal(await exists(value.readyPath), false);
        releaseBootstrap();
        await periodicStarted;
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(await exists(value.readyPath), true);
        assert.deepEqual(calls, [true, false]);
        controller.abort();
        releasePeriodic();
        await running;
        assert.equal(await exists(value.readyPath), false);
    } finally {
        controller.abort();
        releaseBootstrap();
        releasePeriodic();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("failed bootstrap stays unready and releases lease", async () => {
    const value = await fixture();
    try {
        await assert.rejects(runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            sync: async () => { throw new Error("private token detail"); },
        }), /bootstrap failed/iu);
        assert.equal(await exists(value.readyPath), false);
        assert.equal(await exists(join(value.deployRoot, ".sync.lock")), true);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("worker lease excludes one-shot sync without touching active workspace", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    let signalReady!: () => void;
    const ready = new Promise<void>((resolve) => { signalReady = resolve; });
    try {
        const running = runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            signal: controller.signal,
            sync: async () => { signalReady(); },
        });
        await ready;
        const activeWorkspace = join(value.deployRoot, ".work", "sync-AbC123");
        await mkdir(activeWorkspace);
        await assert.rejects(runPCloudSync({
            apiHost: "eapi.pcloud.com",
            deployRoot: value.deployRoot,
            folder: { folderId: "42" },
            repositoryRoot: value.environment.MYEXPENSES_REPOSITORY_ROOT,
            timeZone: "Europe/Madrid",
        }, {
            processBackup: async () => { throw new Error("not reached"); },
        }), /active/iu);
        assert.equal(await exists(activeWorkspace), true);
        controller.abort();
        await running;
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejected second worker cannot clear the active worker's readiness", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    let signalBootstrap!: () => void;
    const bootstrapped = new Promise<void>((resolve) => { signalBootstrap = resolve; });
    try {
        const owner = runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            signal: controller.signal,
            sync: async () => { signalBootstrap(); },
        });
        await bootstrapped;
        // oxlint-disable-next-line no-await-in-loop -- wait until this owner publishes readiness.
        for (let attempt = 0; attempt < 100 && !(await exists(value.readyPath)); attempt += 1) {
            // oxlint-disable-next-line no-await-in-loop -- wait until this owner publishes readiness.
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        assert.equal(await exists(value.readyPath), true);
        await assert.rejects(runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            sync: async () => { throw new Error("must not run"); },
        }), /active/iu);
        assert.equal(await exists(value.readyPath), true);
        controller.abort();
        await owner;
        assert.equal(await exists(value.readyPath), false);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("readiness cleanup failure still releases the worker lease", async () => {
    const value = await fixture();
    await mkdir(value.readyPath);
    try {
        await assert.rejects(runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            sync: async () => { throw new Error("must not run"); },
        }), /EISDIR|EPERM/iu);
        const lease = await acquireSyncLease(value.deployRoot);
        await lease.close();
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("periodic failure retains readiness and retries without secret-bearing logs", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    const calls: boolean[] = [];
    const messages: string[] = [];
    let thirdCycle!: () => void;
    const retried = new Promise<void>((resolve) => { thirdCycle = resolve; });
    try {
        const running = runSyncPCloudWorker(value.environment, {
            intervalMs: 10,
            readinessPath: value.readyPath,
            signal: controller.signal,
            sync: async (force) => {
                calls.push(force);
                if (calls.length === 2) {
                    assert.equal(await exists(value.readyPath), true);
                    throw new Error("private token detail");
                }
                if (calls.length === 3) {
                    controller.abort();
                    thirdCycle();
                }
            },
            logger: { info: (message) => messages.push(message) },
        });
        await retried;
        await running;
        assert.deepEqual(calls, [true, false, false]);
        assert.equal(messages.length, 1);
        assert.doesNotMatch(messages[0]!, /private|token/iu);
    } finally {
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("cycle timeout waits for abort cleanup before failing bootstrap", async () => {
    const value = await fixture();
    let cleanupFinished = false;
    try {
        await assert.rejects(runSyncPCloudWorker(value.environment, {
            readinessPath: value.readyPath,
            timeoutMs: 20,
            sync: async (_force, signal) => {
                await new Promise<void>((resolve) => {
                    signal.addEventListener("abort", () => setTimeout(resolve, 40), { once: true });
                });
                cleanupFinished = true;
            },
        }), /bootstrap failed/iu);
        assert.equal(cleanupFinished, true);
        assert.equal(await exists(value.readyPath), false);
        assert.equal((await readStatus(value.deployRoot)).consecutiveFailures, 1);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("invalid worker timing fails before any layout work", async () => {
    const value = await fixture();
    try {
        await assert.rejects(runSyncPCloudWorker({
            ...value.environment,
            MYEXPENSES_SYNC_INTERVAL_SECONDS: "0",
        }), /timing configuration is invalid/iu);
        assert.equal(await exists(value.deployRoot), false);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("worker retries pending mail one per cycle without sending during failed bootstrap", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const controller = new AbortController();
    const notifications = {
        MYEXPENSES_NOTIFICATION_TO: "recipient@example.com",
        MYEXPENSES_NOTIFICATION_FROM: "sender@example.com",
        MYEXPENSES_SMTP_PASSWORD: "private-password",
    };
    const messages: string[] = [];
    const delivered: string[] = [];
    let attempts = 0;
    const deadline = setTimeout(() => controller.abort(), 1_000);
    try {
        await mkdir(value.deployRoot);
        await writeFile(join(value.deployRoot, ".sync-state.json"), JSON.stringify({
            version: 1, fileId: "100", checksumSha1: "a".repeat(40),
            checksumSha256: "1".repeat(64), localSha256: "2".repeat(64),
            size: 4, modifiedEpochSeconds: 1, releaseId: "release-a",
            notifications: {
                lastEnqueuedIdentity: "a".repeat(64),
                enqueued: "2", acknowledged: "0",
            },
        }), { mode: 0o600 });
        let cycles = 0;
        const running = runSyncPCloudWorker({
            ...value.environment, ...notifications,
        }, {
            intervalMs: 10, readinessPath: value.readyPath, signal: controller.signal,
            sync: async (force) => {
                cycles++;
                if (!force) throw new Error("private sync detail");
            },
            sendNotification: async (settings, sequence) => {
                assert.equal(settings.to, notifications.MYEXPENSES_NOTIFICATION_TO);
                attempts++;
                if (attempts === 1) throw new Error("private SMTP response");
                delivered.push(sequence);
                if (delivered.length === 2) controller.abort();
            },
            logger: { info: (message) => messages.push(message) },
        });
        await running;
        const state = JSON.parse(await readFile(join(value.deployRoot, ".sync-state.json"), "utf8"));
        assert.equal(state.notifications.acknowledged, "2");
        assert.equal(attempts, 3);
        assert.ok(cycles >= 3);
        assert.deepEqual(delivered, ["1", "2"]);
        assert.doesNotMatch(messages.join(" "), /private|recipient@example|sender@example/iu);
    } finally {
        clearTimeout(deadline);
        controller.abort();
        await rm(value.root, { force: true, recursive: true });
    }
});

test("failed bootstrap does not attempt a pending notification", async () => {
    const value = await fixture();
    let sends = 0;
    try {
        await assert.rejects(runSyncPCloudWorker({
            ...value.environment,
            MYEXPENSES_NOTIFICATION_TO: "recipient@example.com",
            MYEXPENSES_NOTIFICATION_FROM: "sender@example.com",
            MYEXPENSES_SMTP_PASSWORD: "private-password",
        }, {
            readinessPath: value.readyPath,
            sync: async () => { throw new Error("private bootstrap detail"); },
            sendNotification: async () => { sends++; },
        }), /bootstrap failed/iu);
        assert.equal(sends, 0);
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("acknowledgement failure leaves mail pending for a later retry", { timeout: 5_000 }, async () => {
    const value = await fixture();
    const environment = {
        ...value.environment,
        MYEXPENSES_NOTIFICATION_TO: "recipient@example.com",
        MYEXPENSES_NOTIFICATION_FROM: "sender@example.com",
        MYEXPENSES_SMTP_PASSWORD: "private-password",
    };
    const statePath = join(value.deployRoot, ".sync-state.json");
    let sends = 0;
    try {
        await mkdir(value.deployRoot);
        await writeFile(statePath, JSON.stringify({
            version: 1, fileId: "100", checksumSha1: "a".repeat(40),
            checksumSha256: "1".repeat(64), localSha256: "2".repeat(64),
            size: 4, modifiedEpochSeconds: 1, releaseId: "release-a",
            notifications: {
                lastEnqueuedIdentity: "a".repeat(64),
                enqueued: "1", acknowledged: "0",
            },
        }), { mode: 0o600 });
        const first = new AbortController();
        await runSyncPCloudWorker(environment, {
            readinessPath: value.readyPath, signal: first.signal,
            sync: async () => {},
            sendNotification: async () => { sends++; first.abort(); },
            acknowledgeNotification: async () => { throw new Error("private disk detail"); },
        });
        assert.equal(JSON.parse(await readFile(statePath, "utf8")).notifications.acknowledged, "0");
        const second = new AbortController();
        await runSyncPCloudWorker(environment, {
            readinessPath: value.readyPath, signal: second.signal,
            sync: async () => {},
            sendNotification: async () => { sends++; second.abort(); },
        });
        assert.equal(sends, 2);
        assert.equal(JSON.parse(await readFile(statePath, "utf8")).notifications.acknowledged, "1");
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});
