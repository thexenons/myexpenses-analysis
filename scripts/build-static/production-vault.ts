import { createHash, webcrypto } from "node:crypto";

import {
  decryptCompressedDataset,
  parseStaticVaultEnvelopeJson,
  STATIC_VAULT_MAX_ENVELOPE_BYTES,
  validateStaticVaultPassphrase,
} from "../../src/domain/security/static-vault.ts";
import type { StaticVaultCrypto } from "../../src/domain/security/static-vault.types.ts";
import { readLimitedRegularFile } from "../encrypt-dataset/files.ts";

/** Authenticate the exact bounded source before giving a build its non-secret byte binding. */
export async function verifyProductionVault(vaultPath: string, passphrase: string): Promise<string> {
  validateStaticVaultPassphrase(passphrase);
  const source = await readLimitedRegularFile(vaultPath, STATIC_VAULT_MAX_ENVELOPE_BYTES, "Encrypted dataset vault");
  let decrypted: Uint8Array | undefined;
  try {
    const envelope = parseStaticVaultEnvelopeJson(new TextDecoder("utf-8", { fatal: true }).decode(source));
    decrypted = await decryptCompressedDataset(
      envelope,
      passphrase,
      webcrypto as unknown as StaticVaultCrypto,
    );
    return createHash("sha256").update(source).digest("hex");
  } catch {
    throw new Error("Production vault authentication failed");
  } finally {
    decrypted?.fill(0);
    source.fill(0);
  }
}
