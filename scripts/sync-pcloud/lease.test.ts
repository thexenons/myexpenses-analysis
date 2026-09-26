import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, lstat, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { acquireSyncLease, SyncLeaseBusyError } from "./lease.ts";

test("helper exit keeps the parent's lease, then close permits recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-lease-test-"));
    try {
        const first = await acquireSyncLease(root);
        try {
            await assert.rejects(acquireSyncLease(root), SyncLeaseBusyError);
            assert.equal((await lstat(join(root, ".sync.lock"))).mode & 0o777, 0o600);
        } finally {
            await first.close();
        }
        const second = await acquireSyncLease(root);
        await second.close();
        assert.equal((await lstat(join(root, ".sync.lock"))).isFile(), true);
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});

test("symlink and unsafe lock metadata fail closed", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-lease-unsafe-"));
    const path = join(root, ".sync.lock");
    try {
        await symlink(join(root, "target"), path);
        await assert.rejects(acquireSyncLease(root));
        await rm(path);
        const lease = await acquireSyncLease(root);
        await lease.close();
        await chmod(path, 0o666);
        await assert.rejects(acquireSyncLease(root));
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});

test("missing flock helper fails closed", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-lease-unavailable-"));
    try {
        await assert.rejects(acquireSyncLease(root, "/missing/flock"));
        const lease = await acquireSyncLease(root);
        await lease.close();
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});

test("SIGKILL of parent cannot free a lease held by its build child", { timeout: 5_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-lease-kill-"));
    const moduleUrl = new URL("./lease.ts", import.meta.url).href;
    const script = `import { spawn } from 'node:child_process';
import { acquireSyncLease } from ${JSON.stringify(moduleUrl)};
const lease = await acquireSyncLease(${JSON.stringify(root)});
const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 700)'], {
  stdio: ['ignore', 'ignore', 'ignore', lease.fd],
});
console.log(child.pid);
setInterval(() => {}, 1000);`;
    const parent = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
    });
    try {
        const [data] = await once(parent.stdout!, "data");
        const childPid = Number(String(data).trim());
        assert.ok(Number.isSafeInteger(childPid) && childPid > 0);
        parent.kill("SIGKILL");
        await once(parent, "close");
        await assert.rejects(acquireSyncLease(root), SyncLeaseBusyError);
        let recovered = false;
        for (let attempt = 0; attempt < 30; attempt++) {
            // oxlint-disable-next-line no-await-in-loop -- wait for orphaned child to release its inherited descriptor.
            await new Promise((resolve) => setTimeout(resolve, 50));
            try {
                // oxlint-disable-next-line no-await-in-loop -- each attempt observes the kernel's current lease state.
                const lease = await acquireSyncLease(root);
                // oxlint-disable-next-line no-await-in-loop -- release the successful probe before leaving the retry loop.
                await lease.close();
                recovered = true;
                break;
            } catch (error) {
                if (!(error instanceof SyncLeaseBusyError)) throw error;
            }
        }
        assert.equal(recovered, true);
    } finally {
        parent.kill("SIGKILL");
        await rm(root, { force: true, recursive: true });
    }
});
