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

import { STATIC_VAULT_MAX_ENVELOPE_BYTES } from "../../src/domain/security/static-vault.ts";
import { readValidatedVaultFile } from "../../vite.config.ts";

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
