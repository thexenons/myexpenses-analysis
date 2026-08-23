import { describe, expect, it } from "vitest";

import {
  decryptCompressedDataset,
  encryptCompressedDataset,
  parseStaticVaultEnvelope,
  parseStaticVaultEnvelopeJson,
  serializeStaticVaultEnvelope,
  serializeStaticVaultHeader,
  STATIC_VAULT_MAX_COMPRESSED_BYTES,
  STATIC_VAULT_MAX_ENVELOPE_BYTES,
  StaticVaultUnlockError,
  StaticVaultValidationError,
} from "./static-vault.ts";

const COMPRESSED_FIXTURE = Uint8Array.of(
  31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 171, 86, 74, 203, 172, 40, 41, 45,
  74, 85, 178, 42, 41, 42, 77, 173, 5, 0, 66, 143, 28, 218, 16, 0, 0, 0,
);
const PASSPHRASE = "correct horse battery staple";

function changedBase64(value: string): string {
  const replacement = value[0] === "A" ? "B" : "A";
  return `${replacement}${value.slice(1)}`;
}

describe("static dataset vault", () => {
  it("round-trips compressed bytes through strict JSON", async () => {
    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      PASSPHRASE,
      globalThis.crypto,
    );
    const serialized = serializeStaticVaultEnvelope(envelope);
    const parsed = parseStaticVaultEnvelopeJson(serialized);

    await expect(
      decryptCompressedDataset(parsed, PASSPHRASE, globalThis.crypto),
    ).resolves.toEqual(COMPRESSED_FIXTURE);
    expect(JSON.stringify(JSON.parse(serialized))).toBe(serialized);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.cipher)).toBe(true);
    expect(Object.isFrozen(parsed.kdf)).toBe(true);
  });

  it("retains only immutable ciphertext state across a failed retry", async () => {
    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      PASSPHRASE,
      globalThis.crypto,
    );
    await expect(
      decryptCompressedDataset(
        envelope,
        "another valid passphrase",
        globalThis.crypto,
      ),
    ).rejects.toBeInstanceOf(StaticVaultUnlockError);
    await expect(
      decryptCompressedDataset(envelope, PASSPHRASE, globalThis.crypto),
    ).resolves.toEqual(COMPRESSED_FIXTURE);
  });

  it("uses independent random salt, IV and ciphertext for every encryption", async () => {
    const [first, second] = await Promise.all([
      encryptCompressedDataset(COMPRESSED_FIXTURE, PASSPHRASE, globalThis.crypto),
      encryptCompressedDataset(COMPRESSED_FIXTURE, PASSPHRASE, globalThis.crypto),
    ]);

    expect(first.kdf.salt).not.toBe(second.kdf.salt);
    expect(first.cipher.iv).not.toBe(second.cipher.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("makes wrong passwords and authenticated ciphertext tamper indistinguishable", async () => {
    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      PASSPHRASE,
      globalThis.crypto,
    );
    const tampered = {
      ...envelope,
      ciphertext: changedBase64(envelope.ciphertext),
    };

    const wrongPasswordError = await decryptCompressedDataset(
      envelope,
      "another valid passphrase",
      globalThis.crypto,
    ).catch((error: unknown) => error);
    const tamperError = await decryptCompressedDataset(
      tampered,
      PASSPHRASE,
      globalThis.crypto,
    ).catch((error: unknown) => error);

    expect(wrongPasswordError).toBeInstanceOf(StaticVaultUnlockError);
    expect(tamperError).toBeInstanceOf(StaticVaultUnlockError);
    expect((wrongPasswordError as Error).message).toBe(
      (tamperError as Error).message,
    );
  });

  it("authenticates canonical header fields such as salt and IV", async () => {
    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      PASSPHRASE,
      globalThis.crypto,
    );
    const saltTamper = {
      ...envelope,
      kdf: { ...envelope.kdf, salt: changedBase64(envelope.kdf.salt) },
    };
    const ivTamper = {
      ...envelope,
      cipher: { ...envelope.cipher, iv: changedBase64(envelope.cipher.iv) },
    };

    await expect(
      decryptCompressedDataset(saltTamper, PASSPHRASE, globalThis.crypto),
    ).rejects.toBeInstanceOf(StaticVaultUnlockError);
    await expect(
      decryptCompressedDataset(ivTamper, PASSPHRASE, globalThis.crypto),
    ).rejects.toBeInstanceOf(StaticVaultUnlockError);
  });

  it("rejects extra fields, non-canonical base64 and size declarations", async () => {
    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      PASSPHRASE,
      globalThis.crypto,
    );

    expect(() => parseStaticVaultEnvelope({ ...envelope, extra: true })).toThrow(
      StaticVaultValidationError,
    );
    expect(() =>
      parseStaticVaultEnvelope({
        ...envelope,
        cipher: { ...envelope.cipher, iv: `${envelope.cipher.iv}\n` },
      }),
    ).toThrow(/canonical base64/u);
    expect(() =>
      parseStaticVaultEnvelope({
        ...envelope,
        kdf: { ...envelope.kdf, salt: "AAAAAAAAAAAAAAAAAAAAAB==" },
      }),
    ).toThrow(/canonical base64/u);
    expect(() =>
      parseStaticVaultEnvelope({
        ...envelope,
        compressedBytes: STATIC_VAULT_MAX_COMPRESSED_BYTES + 1,
      }),
    ).toThrow(/outside its allowed range/u);
    expect(() =>
      parseStaticVaultEnvelopeJson(
        " ".repeat(STATIC_VAULT_MAX_ENVELOPE_BYTES + 1),
      ),
    ).toThrow(/envelope exceeds its size limit/iu);
  });

  it("enforces passphrase strength in UTF-8 bytes", async () => {
    await expect(
      encryptCompressedDataset(COMPRESSED_FIXTURE, "too short", globalThis.crypto),
    ).rejects.toMatchObject({ code: "INVALID_PASSPHRASE" });
    await expect(
      encryptCompressedDataset(
        COMPRESSED_FIXTURE,
        "á".repeat(513),
        globalThis.crypto,
      ),
    ).rejects.toMatchObject({ code: "INVALID_PASSPHRASE" });
  });

  it("permits an empty passphrase only behind the explicit development option", async () => {
    await expect(
      encryptCompressedDataset(COMPRESSED_FIXTURE, "", globalThis.crypto),
    ).rejects.toMatchObject({ code: "INVALID_PASSPHRASE" });

    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      "",
      globalThis.crypto,
      { allowEmptyPassphraseForDevelopment: true },
    );
    await expect(
      decryptCompressedDataset(envelope, "", globalThis.crypto),
    ).rejects.toMatchObject({ code: "INVALID_PASSPHRASE" });
    await expect(
      decryptCompressedDataset(envelope, "", globalThis.crypto, {
        allowEmptyPassphraseForDevelopment: true,
      }),
    ).resolves.toEqual(COMPRESSED_FIXTURE);
  });

  it("canonicalizes only header serialization, independent of object key order", async () => {
    const envelope = await encryptCompressedDataset(
      COMPRESSED_FIXTURE,
      PASSPHRASE,
      globalThis.crypto,
    );
    const reordered = {
      ciphertext: envelope.ciphertext,
      kdf: {
        salt: envelope.kdf.salt,
        iterations: envelope.kdf.iterations,
        algorithm: envelope.kdf.algorithm,
      },
      cipher: {
        tagBits: envelope.cipher.tagBits,
        keyBits: envelope.cipher.keyBits,
        iv: envelope.cipher.iv,
        algorithm: envelope.cipher.algorithm,
      },
      compressedBytes: envelope.compressedBytes,
      compression: envelope.compression,
      version: envelope.version,
      format: envelope.format,
    };

    expect(serializeStaticVaultHeader(parseStaticVaultEnvelope(reordered))).toBe(
      serializeStaticVaultHeader(envelope),
    );
    expect(Object.keys(JSON.parse(serializeStaticVaultHeader(envelope)))).toEqual([
      "format",
      "version",
      "compression",
      "compressedBytes",
      "cipher",
      "kdf",
    ]);
  });
});
