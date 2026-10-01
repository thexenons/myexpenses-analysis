import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";

const STATUS_FILE = ".sync-status.json";
const MAX_STATUS_BYTES = 4 * 1024;
const STATUS_KEYS = [
    "version", "lastAttemptEpochMs", "lastSuccessfulCheckEpochMs",
    "lastPublicationConfirmedEpochMs", "consecutiveFailures",
    "lastObservedSourceModifiedEpochSeconds",
] as const;

/** Private, operator-only observations. No identity, checksum, path, or error is persisted. */
export interface SyncStatus {
    readonly version: 1;
    readonly lastAttemptEpochMs: number | null;
    readonly lastSuccessfulCheckEpochMs: number | null;
    readonly lastPublicationConfirmedEpochMs: number | null;
    readonly consecutiveFailures: number;
    readonly lastObservedSourceModifiedEpochSeconds: number | null;
}

export const emptySyncStatus: SyncStatus = {
    version: 1,
    lastAttemptEpochMs: null,
    lastSuccessfulCheckEpochMs: null,
    lastPublicationConfirmedEpochMs: null,
    consecutiveFailures: 0,
    lastObservedSourceModifiedEpochSeconds: null,
};

function nonnegativeSafeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}

function optionalTimestamp(value: unknown): value is number | null {
    return value === null || nonnegativeSafeInteger(value);
}

function parseStatus(bytes: Buffer): SyncStatus {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid sync status");
    }
    const record = value as Record<string, unknown>;
    if (
        Object.keys(record).length !== STATUS_KEYS.length ||
        !STATUS_KEYS.every((key) => Object.hasOwn(record, key)) ||
        record.version !== 1 ||
        !optionalTimestamp(record.lastAttemptEpochMs) ||
        !optionalTimestamp(record.lastSuccessfulCheckEpochMs) ||
        !optionalTimestamp(record.lastPublicationConfirmedEpochMs) ||
        !nonnegativeSafeInteger(record.consecutiveFailures) ||
        !optionalTimestamp(record.lastObservedSourceModifiedEpochSeconds) ||
        (record.lastSuccessfulCheckEpochMs !== null && record.lastAttemptEpochMs === null) ||
        (record.lastPublicationConfirmedEpochMs !== null && record.lastSuccessfulCheckEpochMs === null) ||
        (record.lastObservedSourceModifiedEpochSeconds !== null && record.lastSuccessfulCheckEpochMs === null)
    ) {
        throw new Error("Invalid sync status");
    }
    return record as unknown as SyncStatus;
}

async function assertSafeRoot(root: string): Promise<void> {
    const metadata = await lstat(root);
    if (
        !metadata.isDirectory() || metadata.isSymbolicLink() ||
        (metadata.mode & 0o022) !== 0 ||
        (process.geteuid !== undefined && metadata.uid !== process.geteuid())
    ) {
        throw new Error("Unsafe sync status root");
    }
}

async function statusFileMetadata(path: string, limitSize = true) {
    const metadata = await lstat(path);
    if (
        !metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 ||
        (metadata.mode & 0o777) !== 0o600 ||
        (process.geteuid !== undefined && metadata.uid !== process.geteuid()) ||
        (limitSize && metadata.size > MAX_STATUS_BYTES)
    ) {
        throw new Error("Unsafe sync status file");
    }
    return metadata;
}

export async function readSyncStatus(root: string): Promise<SyncStatus | null> {
    await assertSafeRoot(root);
    const path = join(root, STATUS_FILE);
    let metadata;
    try {
        metadata = await statusFileMetadata(path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (
            !opened.isFile() || opened.dev !== metadata.dev || opened.ino !== metadata.ino ||
            opened.nlink !== 1 || (opened.mode & 0o777) !== 0o600 ||
            (process.geteuid !== undefined && opened.uid !== process.geteuid()) ||
            opened.size > MAX_STATUS_BYTES
        ) {
            throw new Error("Sync status changed while opening");
        }
        const bytes = await handle.readFile();
        try {
            if (bytes.byteLength > MAX_STATUS_BYTES) throw new Error("Sync status too large");
            return parseStatus(bytes);
        } finally {
            bytes.fill(0);
        }
    } finally {
        await handle.close();
    }
}

export async function writeSyncStatus(root: string, status: SyncStatus): Promise<void> {
    await assertSafeRoot(root);
    const destination = join(root, STATUS_FILE);
    const temporary = join(root, `.sync-status.${randomUUID()}.tmp`);
    const bytes = JSON.stringify(status);
    if (Buffer.byteLength(bytes) > MAX_STATUS_BYTES) throw new Error("Sync status too large");
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
        handle = await open(
            temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
        );
        await handle.chmod(0o600);
        await handle.writeFile(bytes, "utf8");
        await handle.sync();
        await handle.close();
        handle = undefined;
        await assertSafeRoot(root);
        try {
            // A private regular file with invalid contents can be replaced without reading it.
            await statusFileMetadata(destination, false);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await rename(temporary, destination);
    } finally {
        await handle?.close().catch(() => undefined);
        await rm(temporary, { force: true }).catch(() => undefined);
    }
}
