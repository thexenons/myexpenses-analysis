import { randomUUID } from "node:crypto";
import {
    chmod,
    link,
    lstat,
    mkdir,
    mkdtemp,
    open,
    readdir,
    readlink,
    realpath,
    rename,
    rm,
    symlink,
    unlink,
} from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

import {
    loadSyncPCloudSecrets,
    type SyncPCloudConfig,
    type SyncPCloudSecrets,
} from "./config.ts";
import {
    PCloudClient,
    type PCloudBackupFile,
    type PCloudClientOptions,
    type PCloudDownloadOptions,
    type PCloudDownloadResult,
    type PCloudVerifiedBackupFile,
} from "./pcloud.ts";

const STATE_VERSION = 1 as const;
const STATE_FILE = ".sync-state.json";
const LOCK_FILE = ".sync.lock";
const CURRENT_LINK = "current";
const RELEASES_DIRECTORY = "releases";
const WORK_DIRECTORY = ".work";
const SAFE_RELEASE_ID = /^[a-z0-9][a-z0-9-]{0,159}$/;
const SAFE_WORKSPACE_NAME = /^sync-[A-Za-z0-9]{6}$/;
const MAX_RELEASE_TREE_ENTRIES = 100_000;
const FORBIDDEN_RELEASE_BASENAMES = new Set([
    "app-dataset.json",
    "source.zip",
    "BACKUP",
    "BACKUP_PREF",
    "ui_settings.preferences_pb",
]);

export interface ProcessBackupInput {
    readonly backupPath: string;
    readonly repositoryRoot: string;
    readonly timeZone: string;
    readonly vaultPassphrase: string;
    readonly workspacePath: string;
}

export interface ProcessBackupResult {
    /** Absolute, real directory inside workspacePath containing static output. */
    readonly buildDirectory: string;
}

export type ProcessBackup = (
    input: ProcessBackupInput,
    signal?: AbortSignal,
) => Promise<ProcessBackupResult>;

export interface SyncLogger {
    readonly info: (message: string) => void;
}

export interface PCloudSyncClient {
    readonly downloadBackup: (
        file: PCloudVerifiedBackupFile,
        destinationPath: string,
        options?: PCloudDownloadOptions,
    ) => Promise<PCloudDownloadResult>;
    readonly getBackupChecksums: (
        file: PCloudBackupFile,
        signal?: AbortSignal,
    ) => Promise<PCloudVerifiedBackupFile>;
    readonly listLatestBackup: (
        selector: SyncPCloudConfig["folder"],
        signal?: AbortSignal,
    ) => Promise<PCloudBackupFile>;
}

export interface PCloudSyncDependencies {
    readonly createClient?: (options: PCloudClientOptions) => PCloudSyncClient;
    readonly loadSecrets?: (
        config: SyncPCloudConfig,
    ) => Promise<SyncPCloudSecrets>;
    readonly logger?: SyncLogger;
    readonly now?: () => number;
    readonly processBackup: ProcessBackup;
    readonly withLock?: <T>(
        deployRoot: string,
        operation: () => Promise<T>,
    ) => Promise<T>;
    readonly writeState?: (
        deployRoot: string,
        state: PCloudSyncState,
    ) => Promise<void>;
}

export interface RunPCloudSyncOptions {
    readonly force?: boolean;
    readonly signal?: AbortSignal;
}

export interface PCloudSyncState {
    readonly checksumSha1: string;
    readonly checksumSha256: string | null;
    readonly fileId: string;
    readonly localSha256: string;
    readonly modifiedEpochSeconds: number;
    readonly releaseId: string;
    readonly size: number;
    readonly version: typeof STATE_VERSION;
}

export type PCloudSyncResult =
    | {
          readonly status: "noop";
          readonly fileId: string;
          readonly releaseId: string;
      }
    | {
          readonly status: "published";
          readonly fileId: string;
          readonly releaseId: string;
          readonly sha256: string;
      };

export class PCloudSyncError extends Error {
    override readonly name = "PCloudSyncError";
}

function isMissing(error: unknown): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
    );
}

function pathInside(parent: string, child: string): boolean {
    const path = relative(parent, child);
    return (
        path !== "" &&
        path !== ".." &&
        !path.startsWith(`..${sep}`) &&
        !isAbsolute(path)
    );
}

async function readStablePrivateFile(
    path: string,
    context: string,
    maximumBytes: number,
): Promise<{ bytes: Buffer; dev: number | bigint; ino: number | bigint }> {
    const metadata = await lstat(path).catch((error: unknown) => {
        throw new PCloudSyncError(`${context} cannot be inspected`, {
            cause: error,
        });
    });
    if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        (metadata.mode & 0o777) !== 0o600 ||
        metadata.size < 1 ||
        metadata.size > maximumBytes
    ) {
        throw new PCloudSyncError(`${context} is unsafe`);
    }
    const handle = await open(path, "r");
    try {
        const opened = await handle.stat();
        if (
            !opened.isFile() ||
            opened.dev !== metadata.dev ||
            opened.ino !== metadata.ino ||
            (opened.mode & 0o777) !== 0o600 ||
            opened.size > maximumBytes
        ) {
            throw new PCloudSyncError(`${context} changed while being opened`);
        }
        const bytes = await handle.readFile();
        if (bytes.byteLength > maximumBytes) {
            bytes.fill(0);
            throw new PCloudSyncError(`${context} exceeds its size limit`);
        }
        return { bytes, dev: metadata.dev, ino: metadata.ino };
    } finally {
        await handle.close();
    }
}

async function ensureRealDirectory(
    path: string,
    mode: number,
    create: boolean,
): Promise<void> {
    if (create) await mkdir(path, { mode, recursive: true });
    const metadata = await lstat(path).catch((error: unknown) => {
        throw new PCloudSyncError("Required deployment directory is unavailable", {
            cause: error,
        });
    });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new PCloudSyncError(
            "Required deployment path must be a real directory",
        );
    }
}

async function assertOwnedDeploymentDirectory(
    path: string,
    context: string,
    requirePrivate: boolean,
): Promise<void> {
    const metadata = await lstat(path);
    const effectiveUserId = process.geteuid?.();
    if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        (effectiveUserId !== undefined && metadata.uid !== effectiveUserId) ||
        (requirePrivate
            ? (metadata.mode & 0o077) !== 0
            : (metadata.mode & 0o022) !== 0)
    ) {
        throw new PCloudSyncError(`${context} has unsafe ownership or permissions`);
    }
}

async function prepareLayout(config: SyncPCloudConfig): Promise<void> {
    await ensureRealDirectory(config.repositoryRoot, 0o755, false);
    await ensureRealDirectory(config.deployRoot, 0o755, true);
    await Promise.all([
        ensureRealDirectory(
            join(config.deployRoot, RELEASES_DIRECTORY),
            0o755,
            true,
        ),
        ensureRealDirectory(
            join(config.deployRoot, WORK_DIRECTORY),
            0o700,
            true,
        ),
    ]);
    await Promise.all([
        assertOwnedDeploymentDirectory(
            config.deployRoot,
            "Deployment root",
            false,
        ),
        assertOwnedDeploymentDirectory(
            join(config.deployRoot, RELEASES_DIRECTORY),
            "Releases directory",
            false,
        ),
        assertOwnedDeploymentDirectory(
            join(config.deployRoot, WORK_DIRECTORY),
            "Private work directory",
            true,
        ),
    ]);
    const [realDeployRoot, realRepositoryRoot] = await Promise.all([
        realpath(config.deployRoot),
        realpath(config.repositoryRoot),
    ]);
    if (
        realDeployRoot === realRepositoryRoot ||
        pathInside(realDeployRoot, realRepositoryRoot) ||
        pathInside(realRepositoryRoot, realDeployRoot)
    ) {
        throw new PCloudSyncError(
            "deployRoot and repositoryRoot resolve to overlapping directory trees",
        );
    }
}

async function defaultWithLock<T>(
    deployRoot: string,
    operation: () => Promise<T>,
): Promise<T> {
    const path = join(deployRoot, LOCK_FILE);
    const createCompleteLock = async () => {
        const temporary = join(
            deployRoot,
            `.${LOCK_FILE}.${randomUUID()}.tmp`,
        );
        let handle: Awaited<ReturnType<typeof open>> | undefined;
        try {
            handle = await open(temporary, "wx", 0o600);
            await handle.writeFile(`${process.pid}\n`, "utf8");
            await handle.sync();
            // Hard-linking within deployRoot is an atomic create-if-absent commit.
            // The visible lock therefore never has an empty/partial PID payload.
            await link(temporary, path);
            return handle;
        } catch (error) {
            await handle?.close().catch(() => undefined);
            throw error;
        } finally {
            await rm(temporary, { force: true }).catch(() => undefined);
        }
    };
    const acquire = async (allowRecovery: boolean) => {
        try {
            return await createCompleteLock();
        } catch (error) {
            if (
                !allowRecovery ||
                !(error instanceof Error) ||
                !("code" in error) ||
                error.code !== "EEXIST"
            ) {
                throw new PCloudSyncError(
                    "Another pCloud synchronization is active",
                    { cause: error },
                );
            }
            const lock = await readStablePrivateFile(
                path,
                "Existing synchronization lock",
                32,
            );
            const source = lock.bytes.toString("utf8");
            lock.bytes.fill(0);
            if (!/^\d+\n$/.test(source)) {
                throw new PCloudSyncError("Existing synchronization lock is invalid");
            }
            const pid = Number(source.trim());
            if (!Number.isSafeInteger(pid) || pid < 1) {
                throw new PCloudSyncError("Existing synchronization lock is invalid");
            }
            try {
                process.kill(pid, 0);
                throw new PCloudSyncError(
                    "Another pCloud synchronization is active",
                );
            } catch (probeError) {
                if (
                    probeError instanceof Error &&
                    "code" in probeError &&
                    probeError.code === "EPERM"
                ) {
                    throw new PCloudSyncError(
                        "Another pCloud synchronization is active",
                    );
                }
                if (
                    probeError instanceof PCloudSyncError ||
                    !(probeError instanceof Error) ||
                    !("code" in probeError) ||
                    probeError.code !== "ESRCH"
                ) {
                    throw probeError;
                }
            }
            const beforeUnlink = await lstat(path);
            if (
                beforeUnlink.dev !== lock.dev ||
                beforeUnlink.ino !== lock.ino
            ) {
                throw new PCloudSyncError(
                    "Existing synchronization lock changed before recovery",
                );
            }
            await unlink(path).catch((unlinkError: unknown) => {
                if (!isMissing(unlinkError)) throw unlinkError;
            });
            return acquire(false);
        }
    };
    const handle = await acquire(true);
    const ownedLock = await handle.stat();
    let completion: { error: unknown; ok: false } | { ok: true; value: T };
    try {
        completion = { ok: true, value: await operation() };
    } catch (error) {
        completion = { error, ok: false };
    }

    let cleanupError: unknown;
    try {
        await handle.close().catch(() => undefined);
        const currentLock = await lstat(path).catch((error: unknown) => {
            if (isMissing(error)) return null;
            throw error;
        });
        if (currentLock !== null) {
            if (
                currentLock.dev !== ownedLock.dev ||
                currentLock.ino !== ownedLock.ino
            ) {
                throw new PCloudSyncError(
                    "Synchronization lock changed while it was owned",
                );
            }
            await unlink(path);
        }
    } catch (error) {
        cleanupError = error;
    }
    if (cleanupError !== undefined) {
        if (!completion.ok) {
            throw new PCloudSyncError(
                "Synchronization and lock cleanup both failed",
                {
                    cause: new AggregateError([
                        completion.error,
                        cleanupError,
                    ]),
                },
            );
        }
        throw cleanupError;
    }
    if (!completion.ok) throw completion.error;
    return completion.value;
}

async function cleanupStaleWorkspaces(deployRoot: string): Promise<void> {
    const workRoot = join(deployRoot, WORK_DIRECTORY);
    const realWorkRoot = await realpath(workRoot);
    const effectiveUserId = process.geteuid?.();
    for (const entry of await readdir(workRoot, { withFileTypes: true })) {
        if (!SAFE_WORKSPACE_NAME.test(entry.name)) continue;
        const workspacePath = join(workRoot, entry.name);
        // oxlint-disable-next-line no-await-in-loop -- stale targets are validated and removed one at a time.
        const metadata = await lstat(workspacePath);
        if (
            !metadata.isDirectory() ||
            metadata.isSymbolicLink() ||
            (metadata.mode & 0o077) !== 0 ||
            (effectiveUserId !== undefined && metadata.uid !== effectiveUserId)
        ) {
            throw new PCloudSyncError(
                "Stale workspace has unsafe ownership or permissions",
            );
        }
        // oxlint-disable-next-line no-await-in-loop -- containment is checked immediately before each removal.
        const realWorkspace = await realpath(workspacePath);
        if (!pathInside(realWorkRoot, realWorkspace)) {
            throw new PCloudSyncError("Stale workspace escapes the work root");
        }
        // oxlint-disable-next-line no-await-in-loop -- bounded sequential deletion avoids racing validation across targets.
        await rm(workspacePath, { recursive: true });
    }
}

function stateObject(value: unknown): PCloudSyncState {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new PCloudSyncError("Synchronization state is invalid");
    }
    const object = value as Record<string, unknown>;
    const keys = [
        "version",
        "fileId",
        "checksumSha1",
        "checksumSha256",
        "size",
        "modifiedEpochSeconds",
        "localSha256",
        "releaseId",
    ];
    if (
        Object.keys(object).length !== keys.length ||
        keys.some((key) => !Object.hasOwn(object, key)) ||
        object.version !== STATE_VERSION ||
        typeof object.fileId !== "string" ||
        !/^\d+$/.test(object.fileId) ||
        typeof object.checksumSha1 !== "string" ||
        !/^[a-f0-9]{40}$/.test(object.checksumSha1) ||
        (object.checksumSha256 !== null &&
            (typeof object.checksumSha256 !== "string" ||
                !/^[a-f0-9]{64}$/.test(object.checksumSha256))) ||
        !Number.isSafeInteger(object.size) ||
        (object.size as number) < 1 ||
        !Number.isSafeInteger(object.modifiedEpochSeconds) ||
        (object.modifiedEpochSeconds as number) < 0 ||
        typeof object.localSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(object.localSha256) ||
        typeof object.releaseId !== "string" ||
        !SAFE_RELEASE_ID.test(object.releaseId)
    ) {
        throw new PCloudSyncError("Synchronization state is invalid");
    }
    return object as unknown as PCloudSyncState;
}

async function readState(deployRoot: string): Promise<PCloudSyncState | null> {
    const path = join(deployRoot, STATE_FILE);
    let metadata;
    try {
        metadata = await lstat(path);
    } catch (error) {
        if (isMissing(error)) return null;
        throw new PCloudSyncError("Synchronization state cannot be inspected", {
            cause: error,
        });
    }
    if (!metadata.isFile()) throw new PCloudSyncError("Synchronization state file is unsafe");
    try {
        const state = await readStablePrivateFile(
            path,
            "Synchronization state file",
            64 * 1024,
        );
        try {
            return stateObject(
                JSON.parse(state.bytes.toString("utf8")) as unknown,
            );
        } finally {
            state.bytes.fill(0);
        }
    } catch (error) {
        if (error instanceof PCloudSyncError) throw error;
        throw new PCloudSyncError("Synchronization state is invalid", {
            cause: error,
        });
    }
}

async function defaultWriteState(
    deployRoot: string,
    state: PCloudSyncState,
): Promise<void> {
    const destination = join(deployRoot, STATE_FILE);
    const temporary = join(
        deployRoot,
        `.${STATE_FILE}.${randomUUID()}.tmp`,
    );
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
        handle = await open(temporary, "wx", 0o600);
        await handle.writeFile(JSON.stringify(state), "utf8");
        await handle.sync();
        await handle.close();
        handle = undefined;
        // rename is the commit point; the O_EXCL temporary file already has 0600.
        await rename(temporary, destination);
    } finally {
        await handle?.close().catch(() => undefined);
        await rm(temporary, { force: true }).catch(() => undefined);
    }
}

function currentTargetFor(releaseId: string): string {
    if (!SAFE_RELEASE_ID.test(releaseId)) {
        throw new PCloudSyncError("Release identifier is unsafe");
    }
    return `${RELEASES_DIRECTORY}/${releaseId}`;
}

async function readCurrentRelease(deployRoot: string): Promise<string | null> {
    const path = join(deployRoot, CURRENT_LINK);
    let metadata;
    try {
        metadata = await lstat(path);
    } catch (error) {
        if (isMissing(error)) return null;
        throw new PCloudSyncError("Current release link cannot be inspected", {
            cause: error,
        });
    }
    if (!metadata.isSymbolicLink()) {
        throw new PCloudSyncError("Current release path must be a symbolic link");
    }
    const target = await readlink(path);
    const match = /^releases\/([a-z0-9][a-z0-9-]{0,159})$/.exec(target);
    if (match === null) {
        throw new PCloudSyncError("Current release link target is unsafe");
    }
    const releaseId = match[1]!;
    return (await releaseDirectoryExists(deployRoot, releaseId))
        ? releaseId
        : null;
}

async function releaseDirectoryExists(
    deployRoot: string,
    releaseId: string,
): Promise<boolean> {
    const path = join(deployRoot, currentTargetFor(releaseId));
    let metadata;
    try {
        metadata = await lstat(path);
    } catch (error) {
        if (isMissing(error)) return false;
        throw new PCloudSyncError("Release directory cannot be inspected", {
            cause: error,
        });
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new PCloudSyncError("Release target must be a real directory");
    }
    return true;
}

async function replaceCurrentRelease(
    deployRoot: string,
    releaseId: string,
): Promise<void> {
    const current = join(deployRoot, CURRENT_LINK);
    const temporary = join(
        deployRoot,
        `.current.${randomUUID()}.tmp`,
    );
    try {
        await symlink(currentTargetFor(releaseId), temporary, "dir");
        await rename(temporary, current);
    } finally {
        await rm(temporary, { force: true }).catch(() => undefined);
    }
}

async function rollbackCurrentRelease(
    deployRoot: string,
    previousReleaseId: string | null,
): Promise<void> {
    if (previousReleaseId === null) {
        await unlink(join(deployRoot, CURRENT_LINK));
    } else {
        await replaceCurrentRelease(deployRoot, previousReleaseId);
    }
}

function stateMatches(
    state: PCloudSyncState,
    file: PCloudVerifiedBackupFile,
): boolean {
    return (
        state.fileId === file.fileId &&
        state.size === file.size &&
        state.checksumSha1 === file.checksumSha1 &&
        state.checksumSha256 === (file.checksumSha256 ?? null)
    );
}

function releaseIdFor(
    file: PCloudVerifiedBackupFile,
    force: boolean,
    now: number,
): string {
    const base = `b${file.nameTimestamp}-f${file.fileId}-c${file.checksumSha1.slice(0, 12)}`;
    const result = force
        ? `${base}-force-${Math.floor(now)}-${randomUUID().slice(0, 8)}`
        : base;
    return currentTargetFor(result).slice(`${RELEASES_DIRECTORY}/`.length);
}

async function availableReleaseId(
    deployRoot: string,
    file: PCloudVerifiedBackupFile,
    force: boolean,
    now: number,
): Promise<string> {
    let candidate = releaseIdFor(file, force, now);
    for (let attempt = 0; attempt < 4; attempt++) {
        // oxlint-disable-next-line no-await-in-loop -- uniqueness checks must observe each candidate in order.
        if (!(await releaseDirectoryExists(deployRoot, candidate))) {
            return candidate;
        }
        candidate = releaseIdFor(file, true, now + attempt);
    }
    throw new PCloudSyncError("Could not allocate a unique release identifier");
}

async function validateBuildDirectory(
    workspacePath: string,
    buildDirectory: string,
): Promise<void> {
    if (!isAbsolute(buildDirectory)) {
        throw new PCloudSyncError("Pipeline output escapes the private workspace");
    }
    const metadata = await lstat(buildDirectory).catch((error: unknown) => {
        throw new PCloudSyncError("Pipeline output directory is missing", {
            cause: error,
        });
    });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new PCloudSyncError("Pipeline output must be a real directory");
    }
    const [realWorkspace, realBuild] = await Promise.all([
        realpath(workspacePath),
        realpath(buildDirectory),
    ]);
    if (!pathInside(realWorkspace, realBuild)) {
        throw new PCloudSyncError("Pipeline output escapes the private workspace");
    }

    const pending = [realBuild];
    let entries = 0;
    while (pending.length > 0) {
        const directory = pending.pop()!;
        // oxlint-disable-next-line no-await-in-loop -- sequential traversal bounds filesystem concurrency.
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            entries++;
            if (entries > MAX_RELEASE_TREE_ENTRIES) {
                throw new PCloudSyncError(
                    "Pipeline output contains too many filesystem entries",
                );
            }
            const entryPath = join(directory, entry.name);
            // oxlint-disable-next-line no-await-in-loop -- sequential lstat avoids an unbounded promise fan-out.
            const entryMetadata = await lstat(entryPath);
            if (entryMetadata.isSymbolicLink()) {
                throw new PCloudSyncError(
                    "Pipeline output must not contain symbolic links",
                );
            }
            if (entryMetadata.isDirectory()) {
                pending.push(entryPath);
            } else if (!entryMetadata.isFile()) {
                throw new PCloudSyncError(
                    "Pipeline output contains an unsupported filesystem entry",
                );
            } else if (FORBIDDEN_RELEASE_BASENAMES.has(entry.name)) {
                throw new PCloudSyncError(
                    "Pipeline output contains a forbidden plaintext artifact",
                );
            }
        }
    }
}

export async function runPCloudSync(
    config: SyncPCloudConfig,
    dependencies: PCloudSyncDependencies,
    options: RunPCloudSyncOptions = {},
): Promise<PCloudSyncResult> {
    await prepareLayout(config);
    const withLock = dependencies.withLock ?? defaultWithLock;
    return withLock(config.deployRoot, async () => {
        await cleanupStaleWorkspaces(config.deployRoot);
        const secrets = await (dependencies.loadSecrets ?? loadSyncPCloudSecrets)(
            config,
        );
        const client = (dependencies.createClient ??
            ((clientOptions) => new PCloudClient(clientOptions)))(
            {
                apiHost: config.apiHost,
                token: secrets.token,
            },
        );
        const selected = await client.listLatestBackup(
            config.folder,
            options.signal,
        );
        const file = await client.getBackupChecksums(selected, options.signal);
        const [state, currentRelease] = await Promise.all([
            readState(config.deployRoot),
            readCurrentRelease(config.deployRoot),
        ]);
        if (
            options.force !== true &&
            state !== null &&
            stateMatches(state, file) &&
            currentRelease === state.releaseId
        ) {
            dependencies.logger?.info("No new pCloud backup to deploy.");
            return {
                status: "noop",
                fileId: file.fileId,
                releaseId: state.releaseId,
            };
        }

        const workRoot = join(config.deployRoot, WORK_DIRECTORY);
        const workspacePath = await mkdtemp(join(workRoot, "sync-"));
        await chmod(workspacePath, 0o700);
        if (!pathInside(workRoot, workspacePath)) {
            throw new PCloudSyncError("Workspace cleanup target is unsafe");
        }
        try {
            const backupPath = join(workspacePath, "source.zip");
            const download = await client.downloadBackup(file, backupPath, {
                signal: options.signal,
            });
            const processed = await dependencies.processBackup(
                {
                    backupPath,
                    repositoryRoot: config.repositoryRoot,
                    timeZone: config.timeZone,
                    vaultPassphrase: secrets.vaultPassphrase,
                    workspacePath,
                },
                options.signal,
            );
            await validateBuildDirectory(
                workspacePath,
                processed.buildDirectory,
            );
            const releaseId = await availableReleaseId(
                config.deployRoot,
                file,
                options.force === true,
                (dependencies.now ?? Date.now)(),
            );
            const releasePath = join(
                config.deployRoot,
                RELEASES_DIRECTORY,
                releaseId,
            );
            if (
                !pathInside(
                    join(config.deployRoot, RELEASES_DIRECTORY),
                    releasePath,
                )
            ) {
                throw new PCloudSyncError("Release target escapes deployRoot");
            }
            await rename(processed.buildDirectory, releasePath);
            // Remove the source backup before making the new release visible.
            await rm(workspacePath, { force: true, recursive: true });
            const previousRelease = await readCurrentRelease(config.deployRoot);
            await replaceCurrentRelease(config.deployRoot, releaseId);
            const nextState: PCloudSyncState = {
                version: STATE_VERSION,
                fileId: file.fileId,
                checksumSha1: file.checksumSha1,
                checksumSha256: file.checksumSha256 ?? null,
                size: file.size,
                modifiedEpochSeconds: file.modifiedEpochSeconds,
                localSha256: download.sha256,
                releaseId,
            };
            try {
                await (dependencies.writeState ?? defaultWriteState)(
                    config.deployRoot,
                    nextState,
                );
            } catch (error) {
                try {
                    await rollbackCurrentRelease(
                        config.deployRoot,
                        previousRelease,
                    );
                } catch (rollbackError) {
                    throw new PCloudSyncError(
                        "State write and current-release rollback both failed",
                        { cause: rollbackError },
                    );
                }
                throw new PCloudSyncError(
                    "Synchronization state could not be committed",
                    { cause: error },
                );
            }
            dependencies.logger?.info("Published a new pCloud backup release.");
            return {
                status: "published",
                fileId: file.fileId,
                releaseId,
                sha256: download.sha256,
            };
        } finally {
            await rm(workspacePath, { force: true, recursive: true });
        }
    });
}
