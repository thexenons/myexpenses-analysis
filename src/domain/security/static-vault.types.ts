export interface StaticVaultCipherV1 {
  readonly algorithm: "AES-256-GCM";
  readonly iv: string;
  readonly keyBits: 256;
  readonly tagBits: 128;
}

export interface StaticVaultKdfV1 {
  readonly algorithm: "PBKDF2-HMAC-SHA-256";
  readonly iterations: 600_000;
  readonly salt: string;
}

export interface StaticVaultHeaderV1 {
  readonly format: "myexpenses-static-vault";
  readonly version: 1;
  readonly compression: "gzip";
  readonly compressedBytes: number;
  readonly cipher: StaticVaultCipherV1;
  readonly kdf: StaticVaultKdfV1;
}

export interface StaticVaultEnvelopeV1 extends StaticVaultHeaderV1 {
  /** AES-GCM output: encrypted gzip bytes followed by its 128-bit tag. */
  readonly ciphertext: string;
}

/** Resolves to the platform Web Crypto implementation in browsers and Node. */
export type StaticVaultCrypto = typeof globalThis.crypto;

export interface StaticVaultPassphraseOptions {
  /** Explicitly permits an empty key only for local development tooling. */
  readonly allowEmptyPassphraseForDevelopment?: boolean;
}

export type StaticVaultErrorCode =
  | "INVALID_PASSPHRASE"
  | "INVALID_VAULT"
  | "VAULT_LIMIT_EXCEEDED";
