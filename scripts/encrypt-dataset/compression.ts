import { constants, gzip, gunzip } from "node:zlib";

import { STATIC_VAULT_MAX_COMPRESSED_BYTES } from "../../src/domain/security/static-vault.ts";
import { DatasetEncryptionError } from "./errors.ts";

export const MAX_DATASET_JSON_BYTES = 64 * 1024 * 1024;

export interface DatasetCompressionLimits {
    readonly maxCompressedBytes?: number;
    readonly maxDecompressedBytes?: number;
}

function positiveLimit(value: number, context: string): number {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            `${context} must be a positive safe integer`,
        );
    }
    return value;
}

function gzipAsync(source: Uint8Array): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        gzip(
            source,
            { finishFlush: constants.Z_FINISH, level: 9 },
            (error, result) => (error === null ? resolve(result) : reject(error)),
        );
    });
}

function gunzipAsync(
    source: Uint8Array,
    maximumBytes: number,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        gunzip(
            source,
            { finishFlush: constants.Z_FINISH, maxOutputLength: maximumBytes },
            (error, result) => (error === null ? resolve(result) : reject(error)),
        );
    });
}

export async function gzipDataset(
    source: Uint8Array,
    limits: DatasetCompressionLimits = {},
): Promise<Uint8Array> {
    if (!(source instanceof Uint8Array)) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            "Dataset source must be bytes",
        );
    }
    const maximumInput = positiveLimit(
        limits.maxDecompressedBytes ?? MAX_DATASET_JSON_BYTES,
        "Dataset input limit",
    );
    const maximumCompressed = positiveLimit(
        limits.maxCompressedBytes ?? STATIC_VAULT_MAX_COMPRESSED_BYTES,
        "Compressed dataset limit",
    );
    if (source.byteLength > maximumInput) {
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            "Dataset exceeds its uncompressed size limit",
        );
    }

    let result: Buffer;
    try {
        result = await gzipAsync(source);
    } catch (error) {
        throw new DatasetEncryptionError(
            "INVALID_DATASET",
            "Dataset could not be compressed",
            { cause: error },
        );
    }
    if (result.byteLength > maximumCompressed) {
        result.fill(0);
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            "Compressed dataset exceeds the vault limit",
        );
    }
    return result;
}

/** Used by tests and future Node readers; browsers enforce the same output cap. */
export async function gunzipDataset(
    source: Uint8Array,
    limits: DatasetCompressionLimits = {},
): Promise<Uint8Array> {
    if (!(source instanceof Uint8Array)) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            "Compressed dataset must be bytes",
        );
    }
    const maximumCompressed = positiveLimit(
        limits.maxCompressedBytes ?? STATIC_VAULT_MAX_COMPRESSED_BYTES,
        "Compressed dataset limit",
    );
    const maximumOutput = positiveLimit(
        limits.maxDecompressedBytes ?? MAX_DATASET_JSON_BYTES,
        "Dataset output limit",
    );
    if (source.byteLength > maximumCompressed) {
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            "Compressed dataset exceeds its input limit",
        );
    }
    try {
        return await gunzipAsync(source, maximumOutput);
    } catch (error) {
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            "Compressed dataset is invalid or exceeds its output limit",
            { cause: error },
        );
    }
}
