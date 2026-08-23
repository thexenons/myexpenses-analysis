import { webcrypto } from "node:crypto";
import { resolve } from "node:path";

import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import type { StaticVaultCrypto } from "../../src/domain/security/static-vault.types.ts";
import {
    encryptCompressedDataset,
    serializeStaticVaultEnvelope,
    STATIC_VAULT_MAX_ENVELOPE_BYTES,
} from "../../src/domain/security/static-vault.ts";
import { gzipDataset, MAX_DATASET_JSON_BYTES } from "./compression.ts";
import { DatasetEncryptionError } from "./errors.ts";
import {
    readLimitedRegularFile,
    writePrivateFileAtomically,
} from "./files.ts";

export interface EncryptDatasetOptions {
    readonly cryptoProvider?: StaticVaultCrypto;
    readonly inputPath: string;
    readonly outputPath: string;
    readonly passphrase: string;
}

export interface EncryptDatasetResult {
    readonly compressedBytes: number;
    readonly inputBytes: number;
    readonly outputBytes: number;
}

function explicitPath(value: string, context: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            `${context} must be an explicit file path`,
        );
    }
    return value;
}

function parseDatasetSource(source: Uint8Array): void {
    let text: string;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(source);
    } catch (error) {
        throw new DatasetEncryptionError(
            "INVALID_DATASET",
            "Dataset must be valid UTF-8 JSON",
            { cause: error },
        );
    }
    let value: unknown;
    try {
        value = JSON.parse(text) as unknown;
    } catch (error) {
        throw new DatasetEncryptionError(
            "INVALID_DATASET",
            "Dataset must be valid JSON",
            { cause: error },
        );
    }
    try {
        parseBackupDataset(value);
    } catch (error) {
        throw new DatasetEncryptionError(
            "INVALID_DATASET",
            "Dataset does not satisfy the BackupDatasetV1 contract",
            { cause: error },
        );
    }
}

/** Validates, gzips and encrypts one static application dataset. */
export async function encryptDataset(
    options: EncryptDatasetOptions,
): Promise<EncryptDatasetResult> {
    const inputPath = explicitPath(options.inputPath, "Input path");
    const outputPath = explicitPath(options.outputPath, "Output path");
    if (resolve(inputPath) === resolve(outputPath)) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            "Input and output paths must differ",
        );
    }
    const input = await readLimitedRegularFile(
        inputPath,
        MAX_DATASET_JSON_BYTES,
        "Dataset input",
    );
    let compressed: Uint8Array | undefined;
    try {
        parseDatasetSource(input);
        compressed = await gzipDataset(input);
        const envelope = await encryptCompressedDataset(
            compressed,
            options.passphrase,
            options.cryptoProvider ?? (webcrypto as unknown as StaticVaultCrypto),
        );
        const serialized = serializeStaticVaultEnvelope(envelope);
        const outputBytes = new TextEncoder().encode(serialized).byteLength;
        if (outputBytes > STATIC_VAULT_MAX_ENVELOPE_BYTES) {
            throw new DatasetEncryptionError(
                "DATASET_LIMIT_EXCEEDED",
                "Encrypted envelope exceeds its output limit",
            );
        }
        await writePrivateFileAtomically(outputPath, serialized);
        return {
            compressedBytes: compressed.byteLength,
            inputBytes: input.byteLength,
            outputBytes,
        };
    } finally {
        input.fill(0);
        compressed?.fill(0);
    }
}
