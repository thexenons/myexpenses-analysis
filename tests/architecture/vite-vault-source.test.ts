import assert from "node:assert/strict";
import {
  mkdtemp,
  open,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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
