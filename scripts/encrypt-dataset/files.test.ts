import assert from "node:assert/strict";
import {
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writePrivateFileAtomically } from "./files.ts";

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
