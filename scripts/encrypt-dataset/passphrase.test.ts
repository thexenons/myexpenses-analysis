import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { ReadStream, WriteStream } from "node:tty";

import {
    promptForConfirmedPassphrase,
    readHiddenPassphrase,
    readPassphraseFile,
} from "./passphrase.ts";

const PASSPHRASE = "correct horse battery staple";

test("reads one UTF-8 line only from a private regular passphrase file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-passphrase-test-"));
    const filePath = join(directory, "passphrase.txt");
    try {
        await writeFile(filePath, `${PASSPHRASE}\r\n`, { mode: 0o600 });
        await chmod(filePath, 0o400);
        assert.equal(await readPassphraseFile(filePath), PASSPHRASE);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rejects passphrase files readable by group or other users", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-passphrase-mode-test-"));
    const filePath = join(directory, "passphrase.txt");
    try {
        await writeFile(filePath, PASSPHRASE, { mode: 0o600 });
        await chmod(filePath, 0o640);
        await assert.rejects(
            readPassphraseFile(filePath),
            (error: unknown) =>
                error instanceof Error &&
                "code" in error &&
                error.code === "INSECURE_PASSPHRASE_FILE",
        );
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rejects a symlink as the passphrase-file boundary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-passphrase-link-test-"));
    const targetPath = join(directory, "target.txt");
    const linkPath = join(directory, "link.txt");
    try {
        await writeFile(targetPath, PASSPHRASE, { mode: 0o600 });
        await symlink(targetPath, linkPath);
        await assert.rejects(readPassphraseFile(linkPath), /regular file/iu);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("hidden prompt requires a strong matching confirmation", async () => {
    const prompts: string[] = [];
    const values = [PASSPHRASE, PASSPHRASE];
    const confirmed = await promptForConfirmedPassphrase(async (prompt) => {
        prompts.push(prompt);
        return values.shift()!;
    });
    assert.equal(confirmed, PASSPHRASE);
    assert.deepEqual(prompts, ["Vault passphrase: ", "Confirm passphrase: "]);

    const mismatched = [PASSPHRASE, "another valid passphrase"];
    await assert.rejects(
        promptForConfirmedPassphrase(async () => mismatched.shift()!),
        /confirmation does not match/iu,
    );
    await assert.rejects(
        promptForConfirmedPassphrase(async () => "too short"),
        /16 to 1024 UTF-8 bytes/iu,
    );
});

test("TTY entry does not echo secret characters and restores raw mode", async () => {
    const input = new PassThrough();
    const rawModes: boolean[] = [];
    let isRaw = false;
    Object.defineProperties(input, {
        isRaw: { configurable: true, get: () => isRaw },
        isTTY: { configurable: true, value: true },
        setRawMode: {
            configurable: true,
            value: (mode: boolean) => {
                isRaw = mode;
                rawModes.push(mode);
                return input;
            },
        },
    });
    const outputChunks: string[] = [];
    const output = {
        write: ((chunk: string | Uint8Array) => {
            outputChunks.push(String(chunk));
            return true;
        }) as WriteStream["write"],
    };

    const resultPromise = readHiddenPassphrase(
        "Secret: ",
        input as unknown as ReadStream,
        output,
    );
    input.write(`${PASSPHRASE}\r`);
    const result = await resultPromise;
    input.destroy();

    assert.equal(result, PASSPHRASE);
    assert.equal(outputChunks.join(""), "Secret: \n");
    assert.doesNotMatch(outputChunks.join(""), /correct horse/u);
    assert.deepEqual(rawModes, [true, false]);
});
