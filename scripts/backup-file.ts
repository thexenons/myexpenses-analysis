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
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day ||
        hour > 23 ||
        minute > 59 ||
        second > 59
    ) {
        throw new BackupFileNameError(
            "MyExpenses backup filename contains an invalid timestamp",
        );
    }
    return {
        name,
        timestamp:
            `${yearText}${monthText}${dayText}` +
            `${hourText}${minuteText}${secondText}`,
    };
}
