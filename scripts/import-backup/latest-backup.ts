import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
    BackupFileNameError,
    parseBackupFileName,
} from "../backup-file.ts";

export class LatestBackupError extends Error {
    override readonly name = "LatestBackupError";
}

/** Selects the newest valid timestamp embedded in a direct child filename. */
export async function findLatestBackupFile(directoryPath: string): Promise<string> {
    const metadata = await lstat(directoryPath).catch((error: unknown) => {
        throw new LatestBackupError("Backup input directory cannot be inspected", {
            cause: error,
        });
    });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new LatestBackupError(
            "Backup input directory must be a real directory",
        );
    }
    const candidates: Array<{ name: string; timestamp: string }> = [];
    for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        try {
            const parsed = parseBackupFileName(entry.name);
            if (parsed !== null) candidates.push(parsed);
        } catch (error) {
            if (error instanceof BackupFileNameError) {
                throw new LatestBackupError(error.message, { cause: error });
            }
            throw error;
        }
    }
    candidates.sort(
        (left, right) =>
            right.timestamp.localeCompare(left.timestamp) ||
            right.name.localeCompare(left.name),
    );
    const latest = candidates[0];
    if (latest === undefined) {
        throw new LatestBackupError(
            "Backup input directory contains no valid MyExpenses backup",
        );
    }
    return join(directoryPath, latest.name);
}
