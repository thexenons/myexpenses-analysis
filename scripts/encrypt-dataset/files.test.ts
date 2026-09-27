import assert from "node:assert/strict";
import {
    appendFile,
    lstat,
    mkdir,
    mkdtemp,
    open,
    readFile,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readLimitedRegularFile, writePrivateFileAtomically } from "./files.ts";

test("limits allocation and rejects a regular input grown while reading", async (context) => {
    const directory = await mkdtemp(join(tmpdir(), "vault-input-growth-test-"));
    const path = join(directory, "input.json");
    const probe = await open(path, "w+", 0o600);
    try {
        await probe.writeFile("data");
        const prototype = Object.getPrototypeOf(probe) as {
            read: (this: FileHandle, buffer: Buffer, offset: number, length: number, position: number) => Promise<{ bytesRead: number; buffer: Buffer }>;
            readFile: (this: FileHandle) => Promise<Buffer>;
        };
        const originalRead = prototype.read;
        let grew = false;
        const unboundedRead = context.mock.method(prototype, "readFile", async () => {
            throw new Error("unbounded readFile was used");
        });
        context.mock.method(prototype, "read", async function (this: FileHandle, buffer: Buffer, offset: number, length: number, position: number) {
            if (!grew) {
                grew = true;
                await appendFile(path, "growth");
            }
            return originalRead.call(this, buffer, offset, length, position);
        });

        await assert.rejects(
            readLimitedRegularFile(path, 16, "Synthetic input"),
            /changed while it was being read/iu,
        );
        assert.equal(grew, true);
        assert.equal(unboundedRead.mock.callCount(), 0);
    } finally {
        await probe.close();
        await rm(directory, { force: true, recursive: true });
    }
});

test("atomically replaces output with a private regular file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-file-test-"));
    const path = join(directory, "vault.json");
    try {
        await writeFile(path, "old", { mode: 0o644 });
        await writePrivateFileAtomically(path, "encrypted");
        assert.equal(await readFile(path, "utf8"), "encrypted");
        const metadata = await lstat(path);
        assert.equal(metadata.isFile(), true);
        assert.equal(metadata.isSymbolicLink(), false);
        assert.equal(metadata.mode & 0o777, 0o600);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rejects a symlinked output parent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-parent-test-"));
    const realParent = join(directory, "real");
    const linkedParent = join(directory, "linked");
    await mkdir(realParent);
    await symlink(realParent, linkedParent);
    try {
        await assert.rejects(
            writePrivateFileAtomically(join(linkedParent, "vault.json"), "encrypted"),
            /parent must be a real directory/iu,
        );
        assert.deepEqual(await readFile(join(realParent, "vault.json")).catch(() => null), null);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});
