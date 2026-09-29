import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { link, lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { parseBackupFileName } from "../backup-file.ts";
import { PCloudClient, type PCloudVerifiedBackupFile } from "./pcloud.ts";
import type { PCloudSourceConfig } from "./source-config.ts";

export class LocalBackupError extends Error {
    override readonly name = "LocalBackupError";
}

export interface LocalBackupDependencies {
    readonly createClient?: (source: PCloudSourceConfig) => Pick<
        PCloudClient, "listLatestBackup" | "getBackupChecksums" | "downloadBackup"
    >;
}

interface LocalBackupOptions {
    readonly cwd: string;
    readonly force: boolean;
    readonly signal?: AbortSignal;
}

function checkCancellation(signal?: AbortSignal): void {
    if (signal?.aborted) throw new LocalBackupError("Backup download was cancelled");
}

function hasCode(error: unknown, code: string): boolean {
    return error instanceof Error && "code" in error && error.code === code;
}

async function destinationEntry(path: string): Promise<Stats | undefined> {
    let entry: Stats;
    try {
        entry = await lstat(path);
    } catch (error) {
        if (hasCode(error, "ENOENT")) return undefined;
        throw error;
    }
    if (!entry.isFile()) {
        throw new LocalBackupError("The local backup destination must be a regular file, not a symlink or directory");
    }
    return entry;
}

function sameEntry(left: Stats, right: Stats): boolean {
    return left.dev === right.dev && left.ino === right.ino;
}

async function matchesBackup(
    path: string,
    entry: Stats,
    file: PCloudVerifiedBackupFile,
    signal?: AbortSignal,
): Promise<boolean> {
    // O_NOFOLLOW closes the leaf-symlink race between inspection and open.
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || !sameEntry(entry, opened)) {
            throw new LocalBackupError("The local backup changed during verification; retry");
        }
        if (opened.size !== file.size) return false;
        const sha1 = createHash("sha1");
        const sha256 = createHash("sha256");
        const stream = handle.createReadStream({ autoClose: false, signal });
        for await (const chunk of stream) {
            sha1.update(chunk);
            sha256.update(chunk);
        }
        const after = await handle.stat();
        const visible = await destinationEntry(path);
        if (
            visible === undefined || !sameEntry(opened, visible) ||
            opened.size !== after.size || opened.mtimeMs !== after.mtimeMs ||
            opened.ctimeMs !== after.ctimeMs
        ) {
            throw new LocalBackupError("The local backup changed during verification; retry");
        }
        return sha1.digest("hex") === file.checksumSha1 &&
            (file.checksumSha256 === undefined || sha256.digest("hex") === file.checksumSha256);
    } finally {
        await handle.close();
    }
}

/** Recover an untouched ZIP; import, encryption and deployment are separate flows. */
export async function downloadLatestPCloudBackup(
    source: PCloudSourceConfig,
    dependencies: LocalBackupDependencies,
    { cwd, force, signal }: LocalBackupOptions,
): Promise<"downloaded" | "noop"> {
    checkCancellation(signal);
    const data = resolve(cwd, "data");
    try {
        await mkdir(data, { mode: 0o700 });
    } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
    }
    const directory = await lstat(data);
    if (!directory.isDirectory()) {
        throw new LocalBackupError("The project data path must be a directory, not a symlink or file");
    }
    const client = dependencies.createClient?.(source) ?? new PCloudClient(source);
    const selected = await client.listLatestBackup(source.folder, signal);
    const file = await client.getBackupChecksums(selected, signal);
    if (parseBackupFileName(file.name) === null) {
        throw new LocalBackupError("The selected backup filename is invalid");
    }
    checkCancellation(signal);
    const destination = join(data, file.name);
    const existing = await destinationEntry(destination);
    if (existing !== undefined && !force) {
        if (await matchesBackup(destination, existing, file, signal)) {
            checkCancellation(signal);
            return "noop";
        }
        throw new LocalBackupError("A different local backup has the same name; use --force to replace it");
    }

    // Same-filesystem, private staging keeps unverified bytes out of final backup paths.
    const staging = join(data, `.pcloud-${randomUUID()}.tmp`);
    await mkdir(staging, { mode: 0o700 });
    try {
        const stagedBackup = join(staging, file.name);
        await client.downloadBackup(file, stagedBackup, { signal });
        checkCancellation(signal);
        const currentDirectory = await lstat(data);
        if (!currentDirectory.isDirectory() || !sameEntry(directory, currentDirectory)) {
            throw new LocalBackupError("The project data directory changed during download; retry");
        }
        await destinationEntry(destination);
        checkCancellation(signal);
        if (force) {
            // Rename replaces the directory entry, never the contents of a hard link.
            await rename(stagedBackup, destination);
        } else {
            try {
                // Atomic no-clobber install: a competing writer always keeps its file.
                await link(stagedBackup, destination);
            } catch (error) {
                if (hasCode(error, "EEXIST")) {
                    throw new LocalBackupError("A local backup appeared during download; retry or use --force");
                }
                throw error;
            }
        }
        return "downloaded";
    } finally {
        await rm(staging, { recursive: true, force: true });
    }
}
