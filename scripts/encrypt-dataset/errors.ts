export type DatasetEncryptionErrorCode =
    | "DATASET_LIMIT_EXCEEDED"
    | "INSECURE_PASSPHRASE_FILE"
    | "INVALID_DATASET"
    | "INVALID_INPUT"
    | "OUTPUT_WRITE_FAILED"
    | "PASSPHRASE_MISMATCH"
    | "TTY_REQUIRED";

export class DatasetEncryptionError extends Error {
    readonly code: DatasetEncryptionErrorCode;

    constructor(
        code: DatasetEncryptionErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.code = code;
        this.name = "DatasetEncryptionError";
    }
}
