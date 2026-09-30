import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptCompressedDataset,
  decryptCompressedDatasetWithKey,
  deriveVaultDecryptionKey,
  encryptCompressedDataset,
  staticVaultEnvelopeDigest,
  StaticVaultUnlockError,
} from "../../src/domain/security/static-vault.ts";

const compressed = Uint8Array.of(
  31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 171, 86, 74, 203, 172, 40, 41, 45,
  74, 85, 178, 42, 41, 42, 77, 173, 5, 0, 66, 143, 28, 218, 16, 0, 0, 0,
);
const password = "correct horse battery staple";

test("remembered key decrypts only its validated envelope without exposing raw key material", async () => {
  const envelope = await encryptCompressedDataset(compressed, password, globalThis.crypto);
  const key = await deriveVaultDecryptionKey(envelope, password, globalThis.crypto);
  assert.equal(key.type, "secret");
  assert.equal(key.algorithm.name, "AES-GCM");
  assert.equal(key.extractable, false);
  assert.deepEqual(key.usages, ["decrypt"]);
  await assert.rejects(globalThis.crypto.subtle.exportKey("raw", key));
  assert.deepEqual(await decryptCompressedDatasetWithKey(envelope, key, globalThis.crypto), compressed);
  assert.deepEqual(await decryptCompressedDataset(envelope, password, globalThis.crypto), compressed);

  const other = await encryptCompressedDataset(compressed, password, globalThis.crypto);
  await assert.rejects(
    decryptCompressedDatasetWithKey(other, key, globalThis.crypto),
    StaticVaultUnlockError,
  );
});

test("digest binds every canonical envelope byte and ignores JSON property order", async () => {
  const envelope = await encryptCompressedDataset(compressed, password, globalThis.crypto);
  const digest = await staticVaultEnvelopeDigest(envelope, globalThis.crypto);
  assert.match(digest, /^[a-f0-9]{64}$/);
  const { ciphertext, ...header } = envelope;
  assert.equal(
    await staticVaultEnvelopeDigest({ ciphertext, ...header }, globalThis.crypto),
    digest,
  );
  const other = await encryptCompressedDataset(compressed, password, globalThis.crypto);
  assert.notEqual(await staticVaultEnvelopeDigest(other, globalThis.crypto), digest);
});

test("key-based decrypt rejects non-decrypt-only or extractable keys", async () => {
  const envelope = await encryptCompressedDataset(compressed, password, globalThis.crypto);
  const raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const extractable = await globalThis.crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["decrypt"]);
  const encryptOnly = await globalThis.crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  await assert.rejects(decryptCompressedDatasetWithKey(envelope, extractable, globalThis.crypto));
  await assert.rejects(decryptCompressedDatasetWithKey(envelope, encryptOnly, globalThis.crypto));
});
