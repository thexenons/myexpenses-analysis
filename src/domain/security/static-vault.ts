import type {
  StaticVaultEnvelopeV1,
  StaticVaultErrorCode,
  StaticVaultCrypto,
  StaticVaultHeaderV1,
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
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
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
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    const bits =
      (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += BASE64_ALPHABET[(bits >>> 18) & 63];
    result += BASE64_ALPHABET[(bits >>> 12) & 63];
    result += second === undefined ? "=" : BASE64_ALPHABET[(bits >>> 6) & 63];
    result += third === undefined ? "=" : BASE64_ALPHABET[bits & 63];
  }
  return result;
}

function decodeBase64(
  value: unknown,
  maximumBytes: number,
  context: string,
): OwnedBytes {
  if (typeof value !== "string" || !BASE64_PATTERN.test(value)) {
    return invalidVault(`${context} must be canonical base64`);
  }
  const maximumCharacters = Math.ceil(maximumBytes / 3) * 4;
  if (value.length > maximumCharacters) {
    return limitExceeded(`${context} exceeds its size limit`);
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
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

function envelopeHeader(envelope: StaticVaultEnvelopeV1): StaticVaultHeaderV1 {
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
    ciphertext: encodeBase64(ciphertext),
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

function passphraseBytes(passphrase: string): OwnedBytes {
  if (typeof passphrase !== "string") {
    throw new StaticVaultValidationError(
      "INVALID_PASSPHRASE",
      "Passphrase must be a string",
    );
  }
  const bytes = utf8Bytes(passphrase, "Passphrase");
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
) {
  const encoded = passphraseBytes(passphrase);
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

export async function encryptCompressedDataset(
  bytes: Uint8Array,
  passphrase: string,
  cryptoProvider: StaticVaultCrypto,
): Promise<StaticVaultEnvelopeV1> {
  assertCompressedDataset(bytes);
  const salt = cryptoProvider.getRandomValues(
    new Uint8Array(STATIC_VAULT_SALT_BYTES),
  );
  const iv = cryptoProvider.getRandomValues(
    new Uint8Array(STATIC_VAULT_IV_BYTES),
  );
  const provisional: StaticVaultEnvelopeV1 = {
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
    ciphertext: encodeBase64(new Uint8Array(bytes.byteLength + STATIC_VAULT_TAG_BYTES)),
  };
  const aad = new TextEncoder().encode(
    JSON.stringify(canonicalHeaderObject(envelopeHeader(provisional))),
  );
  const plaintext = new Uint8Array(bytes.byteLength);
  plaintext.set(bytes);
  try {
    const key = await deriveAesKey(passphrase, salt, cryptoProvider, "encrypt");
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
): Promise<Uint8Array<ArrayBuffer>> {
  const { aad, ciphertext, envelope, iv, salt } = parseEnvelopeParts(value);
  const key = await deriveAesKey(passphrase, salt, cryptoProvider, "decrypt");
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
