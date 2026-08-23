import {
  DatasetTransportError,
  type DatasetRepository,
} from "../../application/ports/dataset-repository.ts";
import { parseBackupDataset } from "../../domain/analytics/normalize-backup-dataset.ts";
import type { StaticVaultEnvelopeV1 } from "../../domain/security/static-vault.types.ts";
import type { StaticVaultCrypto } from "../../domain/security/static-vault.types.ts";

const VAULT_FILE = "app-dataset.vault.json";
const MAX_DECOMPRESSED_DATASET_BYTES = 64 * 1024 * 1024;

type StaticVaultModule = typeof import("../../domain/security/static-vault.ts");

export interface EncryptedDatasetRepositoryRuntime {
  readonly crypto?: StaticVaultCrypto;
  readonly endpointUrl?: string;
  readonly fetch?: typeof fetch;
}

function endpointUrl(): string {
  return `${import.meta.env.BASE_URL}data/${VAULT_FILE}`;
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new DOMException("The operation was aborted", "AbortError");
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readDecompressedText(
  compressed: Uint8Array<ArrayBuffer>,
  signal?: AbortSignal,
): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new DatasetTransportError(
      "This browser does not support gzip decompression",
    );
  }
  const compressedBody = new Response(compressed).body;
  if (compressedBody === null) {
    throw new Error("Could not read compressed dataset");
  }
  const stream = compressedBody.pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let result = "";
  let total = 0;
  try {
    while (true) {
      abortIfNeeded(signal);
      // oxlint-disable-next-line no-await-in-loop -- stream reads are sequential by contract.
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_DECOMPRESSED_DATASET_BYTES) {
        throw new Error("Decompressed dataset exceeds its size limit");
      }
      try {
        result += decoder.decode(value, { stream: true });
      } finally {
        value.fill(0);
      }
    }
    result += decoder.decode();
    return result;
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Best effort: preserve the original decompression/limit error.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function assertedContentLength(
  response: Response,
  maximumBytes: number,
): number | null {
  const value = response.headers.get("content-length");
  if (value === null) return null;
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new Error("Encrypted dataset has an invalid Content-Length");
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length > maximumBytes) {
    throw new Error("Encrypted dataset exceeds its size limit");
  }
  return length;
}

async function readVaultEnvelopeText(
  response: Response,
  maximumBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  assertedContentLength(response, maximumBytes);
  if (response.body === null) {
    const source = await response.text();
    if (new TextEncoder().encode(source).byteLength > maximumBytes) {
      throw new Error("Encrypted dataset exceeds its size limit");
    }
    return source;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let result = "";
  let total = 0;
  try {
    while (true) {
      abortIfNeeded(signal);
      // oxlint-disable-next-line no-await-in-loop -- stream reads are sequential by contract.
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        throw new Error("Encrypted dataset exceeds its size limit");
      }
      try {
        result += decoder.decode(value, { stream: true });
      } finally {
        value.fill(0);
      }
    }
    result += decoder.decode();
    return result;
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Best effort: preserve the original request/limit error.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function decryptVaultResponse(
  envelope: StaticVaultEnvelopeV1,
  passphrase: string,
  cryptoProvider: StaticVaultCrypto,
  security: StaticVaultModule,
  signal?: AbortSignal,
) {
  abortIfNeeded(signal);
  const compressed = await security.decryptCompressedDataset(
    envelope,
    passphrase,
    cryptoProvider,
    { allowEmptyPassphraseForDevelopment: import.meta.env.DEV },
  );
  try {
    abortIfNeeded(signal);
    const json = await readDecompressedText(compressed, signal);
    let dataset: unknown;
    try {
      dataset = JSON.parse(json) as unknown;
    } catch (error) {
      throw new Error("Decrypted dataset is not valid JSON", { cause: error });
    }
    abortIfNeeded(signal);
    return parseBackupDataset(dataset);
  } finally {
    compressed.fill(0);
  }
}

export function createEncryptedHttpDatasetRepository(
  runtime: EncryptedDatasetRepositoryRuntime = {},
): DatasetRepository {
  let cachedEnvelope: StaticVaultEnvelopeV1 | undefined;

  return {
    async load(passphrase, signal) {
      abortIfNeeded(signal);
      const fetcher = runtime.fetch ?? globalThis.fetch;
      const cryptoProvider = runtime.crypto ?? globalThis.crypto;
      if (typeof fetcher !== "function") {
        throw new DatasetTransportError("This browser does not support fetch");
      }
      if (cryptoProvider?.subtle === undefined) {
        throw new DatasetTransportError("This browser does not support Web Crypto");
      }
      if (typeof DecompressionStream === "undefined") {
        throw new DatasetTransportError(
          "This browser does not support gzip decompression",
        );
      }
      const securityPromise = import("../../domain/security/static-vault.ts").catch(
        (error: unknown) => {
          throw new DatasetTransportError(
            "Could not load the vault security module",
            { cause: error },
          );
        },
      );
      if (cachedEnvelope !== undefined) {
        const security = await securityPromise;
        return await decryptVaultResponse(
          cachedEnvelope,
          passphrase,
          cryptoProvider,
          security,
          signal,
        );
      }
      const responsePromise = fetcher(runtime.endpointUrl ?? endpointUrl(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      }).catch((error: unknown) => {
        if (isAbortError(error)) throw error;
        throw new DatasetTransportError("Could not fetch encrypted dataset", {
          cause: error,
        });
      });
      const [response, security] = await Promise.all([
        responsePromise,
        securityPromise,
      ]);
      if (!response.ok) {
        throw new DatasetTransportError(
          `Could not fetch encrypted dataset: HTTP ${response.status}`,
        );
      }
      const contentType = response.headers.get("content-type");
      if (contentType === null || !/\bapplication\/json\b/i.test(contentType)) {
        throw new DatasetTransportError(
          "Could not fetch encrypted dataset: expected JSON",
        );
      }
      try {
        const source = await readVaultEnvelopeText(
          response,
          security.STATIC_VAULT_MAX_ENVELOPE_BYTES,
          signal,
        );
        abortIfNeeded(signal);
        cachedEnvelope = security.parseStaticVaultEnvelopeJson(source);
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new DatasetTransportError(
          "Published encrypted dataset is invalid",
          { cause: error },
        );
      }
      return await decryptVaultResponse(
        cachedEnvelope,
        passphrase,
        cryptoProvider,
        security,
        signal,
      );
    },
  };
}

export const encryptedHttpDatasetRepository =
  createEncryptedHttpDatasetRepository();
