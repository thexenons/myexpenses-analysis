import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { join, resolve } from "node:path";

const LOCK_FILE = ".sync.lock";
const FLOCK_PATH = "/usr/bin/flock";

export class SyncLeaseError extends Error {
    override readonly name: string = "SyncLeaseError";
}

export class SyncLeaseBusyError extends SyncLeaseError {
    override readonly name = "SyncLeaseBusyError";
}

export class SyncLease {
    private closed = false;

    private readonly root: string;
    private readonly handle: FileHandle;

    constructor(root: string, handle: FileHandle) {
        this.root = root;
        this.handle = handle;
    }

    get fd(): number {
        if (this.closed) throw new SyncLeaseError("Synchronization lease is closed");
        return this.handle.fd;
    }

    assertFor(deployRoot: string): void {
        if (this.closed || resolve(deployRoot) !== this.root) {
            throw new SyncLeaseError("Synchronization lease does not match deployment root");
        }
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        await this.handle.close();
    }
}

function flock(fd: number, executable: string): Promise<number> {
    return new Promise((resolveCode, reject) => {
        const helper = spawn(
            executable,
            ["--exclusive", "--nonblock", "--conflict-exit-code", "75", "3"],
            { stdio: ["ignore", "ignore", "ignore", fd] },
        );
        helper.once("error", reject);
        helper.once("close", (code) => resolveCode(code ?? -1));
    });
}

/** Kernel flock survives helper exit and is released when the last duplicated FD closes. */
export async function acquireSyncLease(
    deployRoot: string,
    flockPath = FLOCK_PATH,
): Promise<SyncLease> {
    const path = join(deployRoot, LOCK_FILE);
    let handle: FileHandle;
    try {
        handle = await open(
            path,
            constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
            0o600,
        );
    } catch {
        throw new SyncLeaseError("Synchronization lease cannot be opened safely");
    }
    try {
        const [opened, visible] = await Promise.all([handle.stat(), lstat(path)]);
        if (
            !opened.isFile() || visible.isSymbolicLink() ||
            opened.dev !== visible.dev || opened.ino !== visible.ino ||
            opened.nlink !== 1 || opened.size !== 0 ||
            (opened.mode & 0o777) !== 0o600 ||
            (process.geteuid !== undefined && opened.uid !== process.geteuid())
        ) {
            throw new SyncLeaseError("Synchronization lease has unsafe metadata");
        }
        let code: number;
        try {
            code = await flock(handle.fd, flockPath);
        } catch {
            throw new SyncLeaseError("Synchronization lease helper is unavailable");
        }
        if (code === 75) throw new SyncLeaseBusyError("Another pCloud synchronization is active");
        if (code !== 0) throw new SyncLeaseError("Synchronization lease acquisition failed");
        // Detect path substitution between validation and acquisition.
        const after = await lstat(path);
        if (after.dev !== opened.dev || after.ino !== opened.ino) {
            throw new SyncLeaseError("Synchronization lease path changed");
        }
        return new SyncLease(resolve(deployRoot), handle);
    } catch (error) {
        await handle.close();
        throw error;
    }
}
