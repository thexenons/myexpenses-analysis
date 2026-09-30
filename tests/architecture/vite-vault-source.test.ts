import assert from "node:assert/strict";
import {
  appendFile,
  mkdtemp,
  open,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  encryptCompressedDataset,
  serializeStaticVaultEnvelope,
  STATIC_VAULT_MAX_ENVELOPE_BYTES,
} from "../../src/domain/security/static-vault.ts";
import {
  assertVerifiedVaultDigest,
  readValidatedVaultFile,
} from "../../vite.config.ts";

function structuralVaultFixture(): string {
  return JSON.stringify({
    format: "myexpenses-static-vault",
    version: 1,
    compression: "gzip",
    compressedBytes: 18,
    cipher: {
      algorithm: "AES-256-GCM",
      iv: "AAAAAAAAAAAAAAAA",
      keyBits: 256,
      tagBits: 128,
    },
    kdf: {
      algorithm: "PBKDF2-HMAC-SHA-256",
      iterations: 600_000,
      salt: "AAAAAAAAAAAAAAAAAAAAAA==",
    },
    ciphertext: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  });
}

test("Vite validates and caches only a bounded regular vault file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vite-vault-source-test-"));
  const vaultPath = join(directory, "vault.json");
  const linkPath = join(directory, "vault-link.json");
  const oversizedPath = join(directory, "oversized.json");
  try {
    await writeFile(vaultPath, structuralVaultFixture(), "utf8");
    const first = await readValidatedVaultFile(vaultPath);
    const cached = await readValidatedVaultFile(vaultPath);
    assert.equal(cached, first, "unchanged encrypted source should reuse its buffer");

    await symlink(vaultPath, linkPath);
    await assert.rejects(readValidatedVaultFile(linkPath), /vault is invalid/iu);

    const oversized = await open(oversizedPath, "w", 0o600);
    try {
      await oversized.truncate(STATIC_VAULT_MAX_ENVELOPE_BYTES + 1);
    } finally {
      await oversized.close();
    }
    await assert.rejects(
      readValidatedVaultFile(oversizedPath),
      /vault is invalid/iu,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("Vite reloads an in-place vault replacement despite preserved size and modification time", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vite-vault-replacement-test-"));
  const vaultPath = join(directory, "vault.json");
  const mtime = new Date("2020-01-01T00:00:00.000Z");
  try {
    const original = structuralVaultFixture();
    const replacement = original.replace('"ciphertext":"A', '"ciphertext":"B');
    assert.equal(replacement.length, original.length);
    await writeFile(vaultPath, original, "utf8");
    await utimes(vaultPath, mtime, mtime);
    const first = await readValidatedVaultFile(vaultPath);
    assert.equal(await readValidatedVaultFile(vaultPath), first);
    const before = await stat(vaultPath);

    await delay(20);
    await writeFile(vaultPath, replacement, "utf8");
    await utimes(vaultPath, mtime, mtime);
    const after = await stat(vaultPath);
    assert.deepEqual(
      [after.dev, after.ino, after.mtimeMs, after.size],
      [before.dev, before.ino, before.mtimeMs, before.size],
    );
    assert.notEqual(after.ctimeMs, before.ctimeMs);

    const second = await readValidatedVaultFile(vaultPath);
    assert.notEqual(second, first);
    assert.equal(second.toString("utf8"), replacement);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("Vite rejects an invalid in-place vault replacement instead of serving cached bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vite-vault-invalid-replacement-test-"));
  const vaultPath = join(directory, "vault.json");
  const mtime = new Date("2020-01-01T00:00:00.000Z");
  try {
    const original = structuralVaultFixture();
    const invalid = original.replace('"version":1', '"version":2');
    assert.equal(invalid.length, original.length);
    await writeFile(vaultPath, original, "utf8");
    await utimes(vaultPath, mtime, mtime);
    await readValidatedVaultFile(vaultPath);
    const before = await stat(vaultPath);

    await delay(20);
    await writeFile(vaultPath, invalid, "utf8");
    await utimes(vaultPath, mtime, mtime);
    const after = await stat(vaultPath);
    assert.deepEqual(
      [after.dev, after.ino, after.mtimeMs, after.size],
      [before.dev, before.ino, before.mtimeMs, before.size],
    );
    assert.notEqual(after.ctimeMs, before.ctimeMs);

    await assert.rejects(readValidatedVaultFile(vaultPath), /vault is invalid/iu);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("Vite never reads beyond a regular vault's validated size", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "vite-vault-growth-test-"));
  const vaultPath = join(directory, "vault.json");
  const probe = await open(vaultPath, "w+", 0o600);
  try {
    await probe.writeFile(structuralVaultFixture());
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
        await appendFile(vaultPath, "growth");
      }
      return originalRead.call(this, buffer, offset, length, position);
    });

    await assert.rejects(readValidatedVaultFile(vaultPath), /vault is invalid/iu);
    assert.equal(grew, true);
    assert.equal(unboundedRead.mock.callCount(), 0);
  } finally {
    await probe.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test("production requires the exact preflight digest for the emitted vault bytes", async () => {
  const compressed = Uint8Array.of(
    31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 171, 86, 74, 203, 172, 40, 41,
    45, 74, 85, 178, 42, 41, 42, 77, 173, 5, 0, 66, 143, 28, 218, 16,
    0, 0, 0,
  );
  const developmentEnvelope = await encryptCompressedDataset(
    compressed,
    "",
    globalThis.crypto,
    { allowEmptyPassphraseForDevelopment: true },
  );

  const source = new TextEncoder().encode(serializeStaticVaultEnvelope(developmentEnvelope));
  const digest = (await import("node:crypto")).createHash("sha256").update(source).digest("hex");
  assert.throws(() => assertVerifiedVaultDigest(source, undefined), /preflight digest/iu);
  assert.throws(() => assertVerifiedVaultDigest(source, "not-a-digest"), /preflight digest/iu);
  assert.throws(() => assertVerifiedVaultDigest(source, "0".repeat(64)), /preflight digest/iu);
  assert.doesNotThrow(() => assertVerifiedVaultDigest(source, digest));
});
