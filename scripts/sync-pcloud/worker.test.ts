import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
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
