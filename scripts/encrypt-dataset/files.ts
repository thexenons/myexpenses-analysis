import { randomUUID } from "node:crypto";
import {
    lstat,
    mkdir,
    open,
    rename,
    rm,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { DatasetEncryptionError } from "./errors.ts";

export interface ReadRegularFileOptions {
    readonly requirePrivateMode?: boolean;
}

function sameFile(
    left: Awaited<ReturnType<typeof lstat>>,
    right: Awaited<ReturnType<Awaited<ReturnType<typeof open>>["stat"]>>,
): boolean {
    return left.dev === right.dev && left.ino === right.ino;
}

export async function readLimitedRegularFile(
    filePath: string,
    maximumBytes: number,
    context: string,
    options: ReadRegularFileOptions = {},
): Promise<Buffer> {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            `${context} size limit is invalid`,
        );
    }
    let pathStat: Awaited<ReturnType<typeof lstat>>;
    try {
        pathStat = await lstat(filePath);
    } catch (error) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            `${context} could not be opened`,
            { cause: error },
        );
    }
    if (!pathStat.isFile() || pathStat.isSymbolicLink()) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            `${context} must be a regular file`,
        );
    }
    if (options.requirePrivateMode === true && (pathStat.mode & 0o077) !== 0) {
        throw new DatasetEncryptionError(
            "INSECURE_PASSPHRASE_FILE",
            `${context} must not grant group or other permissions`,
        );
    }
    if (pathStat.size > maximumBytes) {
        throw new DatasetEncryptionError(
            "DATASET_LIMIT_EXCEEDED",
            `${context} exceeds its size limit`,
        );
    }

    let fileHandle: Awaited<ReturnType<typeof open>>;
    try {
        fileHandle = await open(filePath, "r");
    } catch (error) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            `${context} could not be opened`,
            { cause: error },
        );
    }
    try {
        const fileStat = await fileHandle.stat();
        if (
            !fileStat.isFile() ||
            !sameFile(pathStat, fileStat) ||
            fileStat.size > maximumBytes ||
            (options.requirePrivateMode === true &&
                (fileStat.mode & 0o077) !== 0)
        ) {
            throw new DatasetEncryptionError(
                "INVALID_INPUT",
                `${context} changed while it was being opened`,
            );
        }
        const source = await fileHandle.readFile();
        if (source.byteLength > maximumBytes) {
            source.fill(0);
            throw new DatasetEncryptionError(
                "DATASET_LIMIT_EXCEEDED",
                `${context} exceeds its size limit`,
            );
        }
        return source;
    } finally {
        await fileHandle.close();
    }
}

export async function writePrivateFileAtomically(
    filePath: string,
    source: string,
): Promise<void> {
    const directoryPath = dirname(filePath);
    await mkdir(directoryPath, { recursive: true });
    const directoryStat = await lstat(directoryPath);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
        throw new DatasetEncryptionError(
            "OUTPUT_WRITE_FAILED",
            "Encrypted dataset parent must be a real directory",
        );
    }
    const temporaryPath = join(
        directoryPath,
        `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );
    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
    try {
        fileHandle = await open(temporaryPath, "wx", 0o600);
        await fileHandle.writeFile(source, "utf8");
        await fileHandle.sync();
        await fileHandle.close();
        fileHandle = undefined;
        // The O_EXCL temporary file already has 0600; rename is the commit point.
        await rename(temporaryPath, filePath);
    } catch (error) {
        throw new DatasetEncryptionError(
            "OUTPUT_WRITE_FAILED",
            "Encrypted dataset could not be written atomically",
            { cause: error },
        );
    } finally {
        await fileHandle?.close();
        await rm(temporaryPath, { force: true });
    }
}
