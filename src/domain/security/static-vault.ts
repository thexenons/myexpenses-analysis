import type {
  StaticVaultEnvelopeV1,
  StaticVaultErrorCode,
  StaticVaultCrypto,
  StaticVaultHeaderV1,
  StaticVaultPassphraseOptions,
} from "./static-vault.types.ts";

export const STATIC_VAULT_FORMAT = "myexpenses-static-vault" as const;
export const STATIC_VAULT_VERSION = 1 as const;
export const STATIC_VAULT_PBKDF2_ITERATIONS = 600_000 as const;
export const STATIC_VAULT_SALT_BYTES = 16 as const;
export const STATIC_VAULT_IV_BYTES = 12 as const;
export const STATIC_VAULT_TAG_BITS = 128 as const;
export const STATIC_VAULT_TAG_BYTES = STATIC_VAULT_TAG_BITS / 8;
export const STATIC_VAULT_MIN_PASSPHRASE_BYTES = 16 as const;
export const STATIC_VAULT_MAX_PASSPHRASE_BYTES = 1_024 as const;
export const STATIC_VAULT_MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
export const STATIC_VAULT_MAX_CIPHERTEXT_BYTES =
  STATIC_VAULT_MAX_COMPRESSED_BYTES + STATIC_VAULT_TAG_BYTES;
export const STATIC_VAULT_MAX_ENVELOPE_BYTES = 45 * 1024 * 1024;

const GZIP_MINIMUM_BYTES = 18;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const HEADER_KEYS = [
  "format",
  "version",
  "compression",
  "compressedBytes",
  "cipher",
  "kdf",
] as const;
const ENVELOPE_KEYS = [...HEADER_KEYS, "ciphertext"] as const;
const CIPHER_KEYS = ["algorithm", "iv", "keyBits", "tagBits"] as const;
const KDF_KEYS = ["algorithm", "iterations", "salt"] as const;

type JsonRecord = Record<string, unknown>;
type OwnedBytes = Uint8Array<ArrayBuffer>;

interface ParsedEnvelopeParts {
  readonly aad: OwnedBytes;
  readonly ciphertext: OwnedBytes;
  readonly envelope: StaticVaultEnvelopeV1;
  readonly headerJson: string;
  readonly iv: OwnedBytes;
  readonly salt: OwnedBytes;
  readonly serializedBytes: number;
}

const parsedEnvelopeParts = new WeakMap<object, ParsedEnvelopeParts>();

export class StaticVaultValidationError extends Error {
  readonly code: StaticVaultErrorCode;

  constructor(code: StaticVaultErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "StaticVaultValidationError";
  }
}

/** Intentionally indistinguishable for a wrong passphrase or authenticated tamper. */
export class StaticVaultUnlockError extends Error {
  readonly code = "VAULT_UNLOCK_FAILED" as const;

  constructor() {
    super("Unable to unlock the encrypted dataset");
    this.name = "StaticVaultUnlockError";
  }
}

function invalidVault(message: string): never {
  throw new StaticVaultValidationError("INVALID_VAULT", message);
}

function limitExceeded(message: string): never {
  throw new StaticVaultValidationError("VAULT_LIMIT_EXCEEDED", message);
}

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidVault(`${context} must be an object`);
  }
  return value as JsonRecord;
}

function exactKeys(
  value: JsonRecord,
  expected: readonly string[],
  context: string,
): void {
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== "string" || !expected.includes(key)) ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) {
    invalidVault(`${context} has unexpected or missing properties`);
  }
}

function exactString(
  value: unknown,
  expected: string,
  context: string,
): void {
  if (value !== expected) invalidVault(`${context} is unsupported`);
}

function exactInteger(
  value: unknown,
  expected: number,
  context: string,
): void {
  if (value !== expected) invalidVault(`${context} is unsupported`);
}

function safeIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  context: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return limitExceeded(`${context} is outside its allowed range`);
  }
  return value;
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  // A multiple of three avoids padding between chunks; bounded argument counts
  // also keep large vaults below the engine's function-call argument limit.
  const chunkBytes = 24_576;
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + chunkBytes))));
  }
  return chunks.join("");
}

function decodeBase64(
  value: unknown,
  maximumBytes: number,
  context: string,
): OwnedBytes {
  if (typeof value !== "string") {
    return invalidVault(`${context} must be canonical base64`);
  }
  if (value.length === 0 || value.length % 4 !== 0) {
    return invalidVault(`${context} must be canonical base64`);
  }
  const maximumCharacters = Math.ceil(maximumBytes / 3) * 4;
  if (value.length > maximumCharacters) {
    return limitExceeded(`${context} exceeds its size limit`);
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const dataLength = value.length - padding;
  for (let index = 0; index < dataLength; index++) {
    const code = value.charCodeAt(index);
    if (
      !((code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57) ||
        code === 43 || code === 47)
    ) {
      return invalidVault(`${context} must be canonical base64`);
    }
  }
  const byteLength = (value.length / 4) * 3 - padding;
  if (!Number.isSafeInteger(byteLength) || byteLength > maximumBytes) {
    return limitExceeded(`${context} exceeds its decoded size limit`);
  }
  if (padding === 2) {
    const finalData = BASE64_ALPHABET.indexOf(value[value.length - 3]!);
    if ((finalData & 0x0f) !== 0) {
      return invalidVault(`${context} must be canonical base64`);
    }
  } else if (padding === 1) {
    const finalData = BASE64_ALPHABET.indexOf(value[value.length - 2]!);
    if ((finalData & 0x03) !== 0) {
      return invalidVault(`${context} must be canonical base64`);
    }
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return invalidVault(`${context} must be canonical base64`);
  }
  if (binary.length !== byteLength) {
    return invalidVault(`${context} must be canonical base64`);
  }
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function envelopeHeader(envelope: StaticVaultHeaderV1): StaticVaultHeaderV1 {
  return {
    format: STATIC_VAULT_FORMAT,
    version: STATIC_VAULT_VERSION,
    compression: "gzip",
    compressedBytes: envelope.compressedBytes,
    cipher: {
      algorithm: "AES-256-GCM",
      iv: envelope.cipher.iv,
      keyBits: 256,
      tagBits: STATIC_VAULT_TAG_BITS,
    },
    kdf: {
      algorithm: "PBKDF2-HMAC-SHA-256",
      iterations: STATIC_VAULT_PBKDF2_ITERATIONS,
      salt: envelope.kdf.salt,
    },
  };
}

function canonicalHeaderObject(header: StaticVaultHeaderV1): StaticVaultHeaderV1 {
  return {
    format: header.format,
    version: header.version,
    compression: header.compression,
    compressedBytes: header.compressedBytes,
    cipher: {
      algorithm: header.cipher.algorithm,
      iv: header.cipher.iv,
      keyBits: header.cipher.keyBits,
      tagBits: header.cipher.tagBits,
    },
    kdf: {
      algorithm: header.kdf.algorithm,
      iterations: header.kdf.iterations,
      salt: header.kdf.salt,
    },
  };
}

function parseEnvelopeParts(value: unknown): ParsedEnvelopeParts {
  if (typeof value === "object" && value !== null) {
    const cached = parsedEnvelopeParts.get(value);
    if (cached !== undefined) return cached;
  }
  const root = record(value, "Vault envelope");
  exactKeys(root, ENVELOPE_KEYS, "Vault envelope");
  exactString(root.format, STATIC_VAULT_FORMAT, "Vault format");
  exactInteger(root.version, STATIC_VAULT_VERSION, "Vault version");
  exactString(root.compression, "gzip", "Vault compression");
  const compressedBytes = safeIntegerInRange(
    root.compressedBytes,
    GZIP_MINIMUM_BYTES,
    STATIC_VAULT_MAX_COMPRESSED_BYTES,
    "Vault compressedBytes",
  );

  const cipher = record(root.cipher, "Vault cipher");
  exactKeys(cipher, CIPHER_KEYS, "Vault cipher");
  exactString(cipher.algorithm, "AES-256-GCM", "Vault cipher algorithm");
  exactInteger(cipher.keyBits, 256, "Vault cipher keyBits");
  exactInteger(cipher.tagBits, STATIC_VAULT_TAG_BITS, "Vault cipher tagBits");
  const iv = decodeBase64(cipher.iv, STATIC_VAULT_IV_BYTES, "Vault IV");
  if (iv.byteLength !== STATIC_VAULT_IV_BYTES) {
    invalidVault(`Vault IV must contain ${STATIC_VAULT_IV_BYTES} bytes`);
  }

  const kdf = record(root.kdf, "Vault KDF");
  exactKeys(kdf, KDF_KEYS, "Vault KDF");
  exactString(kdf.algorithm, "PBKDF2-HMAC-SHA-256", "Vault KDF algorithm");
  exactInteger(
    kdf.iterations,
    STATIC_VAULT_PBKDF2_ITERATIONS,
    "Vault KDF iterations",
  );
  const salt = decodeBase64(kdf.salt, STATIC_VAULT_SALT_BYTES, "Vault salt");
  if (salt.byteLength !== STATIC_VAULT_SALT_BYTES) {
    invalidVault(`Vault salt must contain ${STATIC_VAULT_SALT_BYTES} bytes`);
  }

  const ciphertext = decodeBase64(
    root.ciphertext,
    STATIC_VAULT_MAX_CIPHERTEXT_BYTES,
    "Vault ciphertext",
  );
  if (ciphertext.byteLength !== compressedBytes + STATIC_VAULT_TAG_BYTES) {
    invalidVault("Vault ciphertext length does not match its authenticated header");
  }

  const cipherHeader = Object.freeze({
    algorithm: "AES-256-GCM" as const,
    iv: encodeBase64(iv),
    keyBits: 256 as const,
    tagBits: STATIC_VAULT_TAG_BITS,
  });
  const kdfHeader = Object.freeze({
    algorithm: "PBKDF2-HMAC-SHA-256" as const,
    iterations: STATIC_VAULT_PBKDF2_ITERATIONS,
    salt: encodeBase64(salt),
  });
  const envelope: StaticVaultEnvelopeV1 = Object.freeze({
    format: STATIC_VAULT_FORMAT,
    version: STATIC_VAULT_VERSION,
    compression: "gzip",
    compressedBytes,
    cipher: cipherHeader,
    kdf: kdfHeader,
    // decodeBase64 already verified alphabet, padding and unused padding bits.
    // Preserve that canonical string instead of allocating it again per byte.
    ciphertext: root.ciphertext as string,
  });
  const headerJson = JSON.stringify(
    canonicalHeaderObject(envelopeHeader(envelope)),
  );
  const parts = {
    aad: new TextEncoder().encode(headerJson),
    ciphertext,
    envelope,
    headerJson,
    iv,
    salt,
    serializedBytes: new TextEncoder().encode(
      JSON.stringify({
        ...canonicalHeaderObject(envelopeHeader(envelope)),
        ciphertext: envelope.ciphertext,
      }),
    ).byteLength,
  } satisfies ParsedEnvelopeParts;
  parsedEnvelopeParts.set(envelope, parts);
  return parts;
}

function utf8Bytes(value: string, context: string): OwnedBytes {
  const bytes = new TextEncoder().encode(value);
  if (new TextDecoder("utf-8", { fatal: true }).decode(bytes) !== value) {
    throw new StaticVaultValidationError(
      "INVALID_PASSPHRASE",
      `${context} must be valid Unicode text`,
    );
  }
  return bytes;
}

function passphraseBytes(
  passphrase: string,
  options: StaticVaultPassphraseOptions = {},
): OwnedBytes {
  if (typeof passphrase !== "string") {
    throw new StaticVaultValidationError(
      "INVALID_PASSPHRASE",
      "Passphrase must be a string",
    );
  }
  const bytes = utf8Bytes(passphrase, "Passphrase");
  if (
    bytes.byteLength === 0 &&
    options.allowEmptyPassphraseForDevelopment === true
  ) {
    return bytes;
  }
  if (
    bytes.byteLength < STATIC_VAULT_MIN_PASSPHRASE_BYTES ||
    bytes.byteLength > STATIC_VAULT_MAX_PASSPHRASE_BYTES
  ) {
    bytes.fill(0);
    throw new StaticVaultValidationError(
      "INVALID_PASSPHRASE",
      `Passphrase must contain ${STATIC_VAULT_MIN_PASSPHRASE_BYTES} to ${STATIC_VAULT_MAX_PASSPHRASE_BYTES} UTF-8 bytes`,
    );
  }
  return bytes;
}

export function validateStaticVaultPassphrase(passphrase: string): void {
  const bytes = passphraseBytes(passphrase);
  bytes.fill(0);
}

function assertCompressedDataset(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array)) {
    invalidVault("Compressed dataset must be bytes");
  }
  if (bytes.byteLength > STATIC_VAULT_MAX_COMPRESSED_BYTES) {
    limitExceeded("Compressed dataset exceeds its size limit");
  }
  if (
    bytes.byteLength < GZIP_MINIMUM_BYTES ||
    bytes[0] !== 0x1f ||
    bytes[1] !== 0x8b ||
    bytes[2] !== 0x08
  ) {
    invalidVault("Compressed dataset must use gzip");
  }
}

async function deriveAesKey(
  passphrase: string,
  salt: OwnedBytes,
  cryptoProvider: StaticVaultCrypto,
  usage: "decrypt" | "encrypt",
  options: StaticVaultPassphraseOptions,
) {
  const encoded = passphraseBytes(passphrase, options);
  try {
    const keyMaterial = await cryptoProvider.subtle.importKey(
      "raw",
      encoded,
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return await cryptoProvider.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: STATIC_VAULT_PBKDF2_ITERATIONS,
        salt,
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      [usage],
    );
  } finally {
    encoded.fill(0);
  }
}

export function serializeStaticVaultHeader(
  envelope: StaticVaultEnvelopeV1,
): string {
  return parseEnvelopeParts(envelope).headerJson;
}

/** Strictly validates an object already decoded from JSON. */
export function parseStaticVaultEnvelope(value: unknown): StaticVaultEnvelopeV1 {
  const parts = parseEnvelopeParts(value);
  if (parts.serializedBytes > STATIC_VAULT_MAX_ENVELOPE_BYTES) {
    limitExceeded("Vault envelope exceeds its size limit");
  }
  return parts.envelope;
}

/** Parses JSON only after enforcing the encoded envelope limit. */
export function parseStaticVaultEnvelopeJson(
  source: string,
): StaticVaultEnvelopeV1 {
  if (typeof source !== "string") invalidVault("Vault JSON must be a string");
  if (
    source.length > STATIC_VAULT_MAX_ENVELOPE_BYTES ||
    new TextEncoder().encode(source).byteLength > STATIC_VAULT_MAX_ENVELOPE_BYTES
  ) {
    limitExceeded("Vault envelope exceeds its size limit");
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return invalidVault("Vault envelope is not valid JSON");
  }
  return parseStaticVaultEnvelope(value);
}

/** Returns compact JSON with a deterministic property order. */
export function serializeStaticVaultEnvelope(
  envelope: StaticVaultEnvelopeV1,
): string {
  const parsed = parseStaticVaultEnvelope(envelope);
  return JSON.stringify({
    ...canonicalHeaderObject(envelopeHeader(parsed)),
    ciphertext: parsed.ciphertext,
  });
}

/** SHA-256 of the complete canonical encrypted envelope, including ciphertext. */
export async function staticVaultEnvelopeDigest(
  value: unknown,
  cryptoProvider: StaticVaultCrypto,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    serializeStaticVaultEnvelope(parseStaticVaultEnvelope(value)),
  );
  const digest = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Derives a key that the browser can clone into IndexedDB but cannot export. */
export async function deriveVaultDecryptionKey(
  value: unknown,
  passphrase: string,
  cryptoProvider: StaticVaultCrypto,
  options: StaticVaultPassphraseOptions = {},
): Promise<CryptoKey> {
  return deriveAesKey(
    passphrase,
    parseEnvelopeParts(value).salt,
    cryptoProvider,
    "decrypt",
    options,
  );
}

export function isVaultDecryptionKey(value: unknown): value is CryptoKey {
  if (typeof value !== "object" || value === null) return false;
  if (typeof CryptoKey === "undefined" || !(value instanceof CryptoKey)) return false;
  const key = value as Partial<CryptoKey>;
  const algorithm = key.algorithm as { name?: unknown; length?: unknown } | undefined;
  return key.type === "secret" && key.extractable === false &&
    algorithm?.name === "AES-GCM" && algorithm.length === 256 &&
    Array.isArray(key.usages) && key.usages.length === 1 && key.usages[0] === "decrypt";
}

export async function decryptCompressedDatasetWithKey(
  value: unknown,
  key: CryptoKey,
  cryptoProvider: StaticVaultCrypto,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!isVaultDecryptionKey(key)) invalidVault("Vault key must be non-extractable and decrypt-only");
  return decryptWithKey(value, key, cryptoProvider);
}

export async function encryptCompressedDataset(
  bytes: Uint8Array,
  passphrase: string,
  cryptoProvider: StaticVaultCrypto,
  options: StaticVaultPassphraseOptions = {},
): Promise<StaticVaultEnvelopeV1> {
  assertCompressedDataset(bytes);
  const salt = cryptoProvider.getRandomValues(
    new Uint8Array(STATIC_VAULT_SALT_BYTES),
  );
  const iv = cryptoProvider.getRandomValues(
    new Uint8Array(STATIC_VAULT_IV_BYTES),
  );
  const provisional: StaticVaultHeaderV1 = {
    format: STATIC_VAULT_FORMAT,
    version: STATIC_VAULT_VERSION,
    compression: "gzip",
    compressedBytes: bytes.byteLength,
    cipher: {
      algorithm: "AES-256-GCM",
      iv: encodeBase64(iv),
      keyBits: 256,
      tagBits: STATIC_VAULT_TAG_BITS,
    },
    kdf: {
      algorithm: "PBKDF2-HMAC-SHA-256",
      iterations: STATIC_VAULT_PBKDF2_ITERATIONS,
      salt: encodeBase64(salt),
    },
  };
  const aad = new TextEncoder().encode(
    JSON.stringify(canonicalHeaderObject(envelopeHeader(provisional))),
  );
  const plaintext = new Uint8Array(bytes.byteLength);
  plaintext.set(bytes);
  try {
    const key = await deriveAesKey(
      passphrase,
      salt,
      cryptoProvider,
      "encrypt",
      options,
    );
    const encrypted = new Uint8Array(
      await cryptoProvider.subtle.encrypt(
        {
          name: "AES-GCM",
          additionalData: aad,
          iv,
          tagLength: STATIC_VAULT_TAG_BITS,
        },
        key,
        plaintext,
      ),
    );
    return parseStaticVaultEnvelope({
      ...provisional,
      ciphertext: encodeBase64(encrypted),
    });
  } finally {
    aad.fill(0);
    plaintext.fill(0);
    salt.fill(0);
    iv.fill(0);
  }
}

export async function decryptCompressedDataset(
  value: unknown,
  passphrase: string,
  cryptoProvider: StaticVaultCrypto,
  options: StaticVaultPassphraseOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await deriveVaultDecryptionKey(value, passphrase, cryptoProvider, options);
  return decryptWithKey(value, key, cryptoProvider);
}

async function decryptWithKey(
  value: unknown,
  key: CryptoKey,
  cryptoProvider: StaticVaultCrypto,
): Promise<Uint8Array<ArrayBuffer>> {
  const { aad, ciphertext, envelope, iv } = parseEnvelopeParts(value);
  let decrypted: Uint8Array<ArrayBuffer>;
  try {
    decrypted = new Uint8Array(
      await cryptoProvider.subtle.decrypt(
        {
          name: "AES-GCM",
          additionalData: aad,
          iv,
          tagLength: STATIC_VAULT_TAG_BITS,
        },
        key,
        ciphertext,
      ),
    );
  } catch {
    throw new StaticVaultUnlockError();
  }
  if (decrypted.byteLength !== envelope.compressedBytes) {
    decrypted.fill(0);
    throw new StaticVaultUnlockError();
  }
  try {
    assertCompressedDataset(decrypted);
  } catch (error) {
    decrypted.fill(0);
    throw error;
  }
  return decrypted;
}
