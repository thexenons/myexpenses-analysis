import { constants } from "node:fs";
import { open, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { acquireSyncLease } from "./lease.ts";
import { prepareSyncLayout, runPCloudSync } from "./orchestrator.ts";
import { processBackupForStaticRelease } from "./process-backup.ts";
import { loadSyncPCloudRuntimeConfig } from "./runtime-config.ts";

const DEFAULT_INTERVAL_SECONDS = 3_600;
const DEFAULT_TIMEOUT_SECONDS = 1_800;
const DEFAULT_READY_PATH = "/run/myexpenses/ready";

export class SyncWorkerError extends Error {
    override readonly name = "SyncWorkerError";
}

export interface SyncWorkerOptions {
    readonly intervalMs?: number;
    readonly readinessPath?: string;
    readonly signal?: AbortSignal;
    readonly sync?: (force: boolean, signal: AbortSignal) => Promise<void>;
    readonly timeoutMs?: number;
    readonly logger?: { readonly info: (message: string) => void };
}

function durationSeconds(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback * 1_000;
    if (!/^[1-9]\d*$/.test(value)) {
        throw new SyncWorkerError("Worker timing configuration is invalid");
    }
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > 86_400) {
        throw new SyncWorkerError("Worker timing configuration is invalid");
    }
    return seconds * 1_000;
}

function checkedMilliseconds(value: number): number {
    if (!Number.isSafeInteger(value) || value < 1 || value > 86_400_000) {
        throw new SyncWorkerError("Worker timing configuration is invalid");
    }
    return value;
}

async function writeReadiness(path: string): Promise<void> {
    const handle = await open(
        path,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
    );
    try {
        await handle.writeFile("ready\n");
    } finally {
        await handle.close();
    }
}

/** One lease spans forced bootstrap and every later non-forced serial cycle. */
export async function runSyncPCloudWorker(
    environment: NodeJS.ProcessEnv,
    options: SyncWorkerOptions = {},
): Promise<void> {
    const runtime = loadSyncPCloudRuntimeConfig(environment);
    const intervalMs = checkedMilliseconds(options.intervalMs ?? durationSeconds(
        environment.MYEXPENSES_SYNC_INTERVAL_SECONDS,
        DEFAULT_INTERVAL_SECONDS,
    ));
    const timeoutMs = checkedMilliseconds(options.timeoutMs ?? durationSeconds(
        environment.MYEXPENSES_SYNC_TIMEOUT_SECONDS,
        DEFAULT_TIMEOUT_SECONDS,
    ));
    const readyPath = options.readinessPath ?? DEFAULT_READY_PATH;
    const signal = options.signal ?? new AbortController().signal;
    await rm(readyPath, { force: true });
    await prepareSyncLayout(runtime.config);
    const lease = await acquireSyncLease(runtime.config.deployRoot);
    const sync = options.sync ?? (async (force: boolean, cycleSignal: AbortSignal) => {
        await runPCloudSync(runtime.config, {
            loadSecrets: async () => runtime.secrets,
            logger: options.logger,
            processBackup: processBackupForStaticRelease,
        }, { force, lease, signal: cycleSignal });
    });
    const cycle = async (force: boolean) => {
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(), timeoutMs);
        const cycleSignal = AbortSignal.any([signal, timeout.signal]);
        try {
            await sync(force, cycleSignal);
            if (timeout.signal.aborted) throw new SyncWorkerError("Sync cycle timed out");
        } finally {
            clearTimeout(timer);
        }
    };
    try {
        signal.throwIfAborted();
        try {
            await cycle(true);
        } catch {
            if (signal.aborted) return;
            throw new SyncWorkerError("Worker bootstrap failed");
        }
        if (signal.aborted) return;
        await writeReadiness(readyPath);
        while (!signal.aborted) {
            try {
                // oxlint-disable-next-line no-await-in-loop -- each cycle waits before starting the next one.
                await delay(intervalMs, undefined, { signal });
            } catch {
                if (signal.aborted) break;
                throw new SyncWorkerError("Worker delay failed");
            }
            if (signal.aborted) break;
            try {
                // oxlint-disable-next-line no-await-in-loop -- sync cycles must never overlap.
                await cycle(false);
            } catch {
                if (signal.aborted) break;
                options.logger?.info("Periodic synchronization failed; retrying.");
            }
        }
    } finally {
        await rm(readyPath, { force: true });
        await lease.close();
    }
}
