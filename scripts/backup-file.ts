import { isValidBackupFilenameTimestamp } from "../src/domain/analytics/backup-provenance.ts";

const BACKUP_FILE_NAME_PATTERN =
    /^myexpenses-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.zip$/;

export class BackupFileNameError extends Error {
    override readonly name = "BackupFileNameError";
}

export interface ParsedBackupFileName {
    readonly name: string;
    readonly timestamp: string;
}

/** Returns null for unrelated files and rejects impossible backup timestamps. */
export function parseBackupFileName(name: string): ParsedBackupFileName | null {
    const match = BACKUP_FILE_NAME_PATTERN.exec(name);
    if (match === null) return null;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
        match;
    const timestamp = `${yearText}${monthText}${dayText}${hourText}${minuteText}${secondText}`;
    if (!isValidBackupFilenameTimestamp(timestamp)) {
        throw new BackupFileNameError(
            "MyExpenses backup filename contains an invalid timestamp",
        );
    }
    return {
        name,
        timestamp,
    };
}
