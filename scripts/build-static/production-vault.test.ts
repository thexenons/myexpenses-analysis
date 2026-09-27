import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  encryptCompressedDataset,
  serializeStaticVaultEnvelope,
} from "../../src/domain/security/static-vault.ts";
import { verifyProductionVault } from "./production-vault.ts";

const compressed = Uint8Array.of(
  31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 171, 86, 74, 203, 172, 40, 41,
  45, 74, 85, 178, 42, 41, 42, 77, 173, 5, 0, 66, 143, 28, 218, 16,
  0, 0, 0,
);
const phrase = "correct horse battery staple";

test("production preflight authenticates exact vault bytes before returning their digest", async () => {
  const root = await mkdtemp(join(tmpdir(), "vault-preflight-"));
  const path = join(root, "vault.json");
  try {
    const envelope = await encryptCompressedDataset(compressed, phrase, globalThis.crypto);
    const bytes = serializeStaticVaultEnvelope(envelope);
    await writeFile(path, bytes);
    assert.equal(await verifyProductionVault(path, phrase), createHash("sha256").update(bytes).digest("hex"));
    await assert.rejects(verifyProductionVault(path, "wrong phrase of adequate length"));
    await assert.rejects(verifyProductionVault(path, ""));

    const damaged = { ...envelope, ciphertext: envelope.ciphertext.replace(/^./u, envelope.ciphertext[0] === "A" ? "B" : "A") };
    await writeFile(path, serializeStaticVaultEnvelope(damaged));
    await assert.rejects(verifyProductionVault(path, phrase));

    const empty = await encryptCompressedDataset(compressed, "", globalThis.crypto, { allowEmptyPassphraseForDevelopment: true });
    await writeFile(path, serializeStaticVaultEnvelope(empty));
    await assert.rejects(verifyProductionVault(path, phrase));
    const malformedEmpty = { ...empty, ciphertext: empty.ciphertext.replace(/^./u, empty.ciphertext[0] === "A" ? "B" : "A") };
    await writeFile(path, serializeStaticVaultEnvelope(malformedEmpty));
    await assert.rejects(verifyProductionVault(path, phrase));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
