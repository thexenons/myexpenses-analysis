import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
    chmod,
    mkdtemp,
    readFile,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    decryptCompressedDataset,
    parseStaticVaultEnvelopeJson,
} from "../../src/domain/security/static-vault.ts";
import type { StaticVaultCrypto } from "../../src/domain/security/static-vault.types.ts";
import { gunzipDataset } from "./compression.ts";
import { encryptDataset } from "./encrypt-dataset.ts";
import { createDatasetFixture } from "./test-fixtures.ts";

const PASSPHRASE = "correct horse battery staple";
const CRYPTO = webcrypto as unknown as StaticVaultCrypto;

test("validates, compresses and atomically writes a private encrypted dataset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-encryption-test-"));
    const inputPath = join(directory, "app-dataset.json");
    const outputPath = join(directory, "app-dataset.vault.json");
    const source = JSON.stringify(createDatasetFixture());
    try {
        await writeFile(inputPath, source, "utf8");
        await writeFile(outputPath, "old-public-output", { mode: 0o644 });
        await chmod(outputPath, 0o644);

        const result = await encryptDataset({
            cryptoProvider: CRYPTO,
            inputPath,
            outputPath,
            passphrase: PASSPHRASE,
        });
        const serialized = await readFile(outputPath, "utf8");
        const envelope = parseStaticVaultEnvelopeJson(serialized);
        const compressed = await decryptCompressedDataset(
            envelope,
            PASSPHRASE,
            CRYPTO,
        );
        const restored = await gunzipDataset(compressed);

        assert.equal(new TextDecoder().decode(restored), source);
        assert.equal(result.inputBytes, Buffer.byteLength(source));
        assert.equal(result.compressedBytes, compressed.byteLength);
        assert.equal(result.outputBytes, Buffer.byteLength(serialized));
        assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
        assert.doesNotMatch(serialized, /Fixture secret label|old-public-output/u);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("invalid source data leaves an existing output untouched", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vault-atomic-failure-test-"));
    const inputPath = join(directory, "invalid.json");
    const outputPath = join(directory, "vault.json");
    try {
        await writeFile(inputPath, JSON.stringify({ version: 1 }), "utf8");
        await writeFile(outputPath, "existing-output", "utf8");

        await assert.rejects(
            encryptDataset({
                cryptoProvider: CRYPTO,
                inputPath,
                outputPath,
                passphrase: PASSPHRASE,
            }),
            /does not satisfy/iu,
        );
        assert.equal(await readFile(outputPath, "utf8"), "existing-output");
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("refuses to overwrite the plaintext input path", async () => {
    await assert.rejects(
        encryptDataset({
            cryptoProvider: CRYPTO,
            inputPath: "data/app-dataset.json",
            outputPath: "data/app-dataset.json",
            passphrase: PASSPHRASE,
        }),
        /paths must differ/iu,
    );
});
