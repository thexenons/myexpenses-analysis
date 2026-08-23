import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";

import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { MAX_DATASET_JSON_BYTES } from "../encrypt-dataset/compression.ts";
import { writeJsonAtomically } from "../files.ts";
import { createAppDataset } from "./app-dataset.ts";
import { readBackupArchive } from "./archive.ts";
import { withBackupDatabase } from "./database.ts";
import { parseBackupPreferences } from "./preferences.ts";
import { parseBudgetUiSettings } from "./ui-settings.ts";
import { adaptV189 } from "./v189/adapter.ts";

const HASH_CHUNK_BYTES = 1024 * 1024;

export interface ImportBackupOptions {
    inputPath: string;
    outputPath: string;
    timeZone: string;
}

export interface ImportBackupResult {
    accountCount: number;
    budgetCount: number;
    categoryCount: number;
    outputPath: string;
    postingCount: number;
}

async function sha256File(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    try {
        for await (const chunk of createReadStream(filePath)) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            try {
                hash.update(bytes);
            } finally {
                bytes.fill(0);
            }
        }
    } catch (error) {
        throw new Error("Could not hash the selected backup", { cause: error });
    }
    return hash.digest("hex");
}

function sha256Bytes(bytes: Uint8Array): string {
    const hash = createHash("sha256");
    for (let offset = 0; offset < bytes.byteLength; offset += HASH_CHUNK_BYTES) {
        hash.update(bytes.subarray(offset, offset + HASH_CHUNK_BYTES));
    }
    return hash.digest("hex");
}

function explicitPath(value: string, name: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${name} must be an explicit file path`);
    }
    return value;
}

function explicitTimeZone(value: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error("timeZone is required");
    }
    try {
        new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    } catch (error) {
        throw new Error("timeZone must be a valid IANA time zone", {
            cause: error,
        });
    }
    return value;
}

function requiredPreference<T>(
    value: T | undefined,
    preferenceName: string,
): T {
    if (value === undefined) {
        throw new Error(`Required backup preference ${preferenceName} is missing`);
    }
    return value;
}

/** Imports one explicit MyExpenses backup into a deterministic public dataset. */
export async function importBackup(
    options: ImportBackupOptions,
): Promise<ImportBackupResult> {
    const inputPath = explicitPath(options.inputPath, "inputPath");
    const outputPath = explicitPath(options.outputPath, "outputPath");
    const timeZone = explicitTimeZone(options.timeZone);
    if (resolve(inputPath) === resolve(outputPath)) {
        throw new Error("The output path must differ from the backup path");
    }

    const backupSha256 = await sha256File(inputPath);
    const archive = await readBackupArchive(inputPath);
    try {
        const verificationHash = await sha256File(inputPath);
        if (verificationHash !== backupSha256) {
            throw new Error("The selected backup changed while it was being read");
        }
        const databaseSha256 = sha256Bytes(archive.database);
        const rawPreferences = parseBackupPreferences(archive.preferencesXml);
        archive.preferencesXml.fill(0);
        const homeCurrency = requiredPreference(
            rawPreferences.homeCurrency,
            "home_currency",
        );
        if (homeCurrency !== "EUR") {
            throw new Error("The backup home currency must be EUR");
        }
        const preferences = {
            homeCurrency,
            monthStart: requiredPreference(
                rawPreferences.groupMonthStart,
                "group_month_start",
            ),
            weekStart: requiredPreference(
                rawPreferences.groupWeekStart,
                "group_week_start",
            ),
            includeTransfers: requiredPreference(
                rawPreferences.historyIncludeTransfers,
                "history_include_transfers",
            ),
            unmappedTransactionsAsTransfers: requiredPreference(
                rawPreferences.unmappedTransactionAsTransfer,
                "unmapped_transaction_as_transfer",
            ),
        };

        const canonical = await withBackupDatabase(archive.database, (database) =>
            adaptV189(database, {
                timeZone,
                preferences: {
                    ...preferences,
                    aggregateNeutral: false,
                    dynamicExchangeRatesMode: "PER_ACCOUNT",
                },
            }),
        );
        archive.database.fill(0);
        if (canonical.budgets.length > 0 && archive.uiSettings === undefined) {
            throw new Error(
                "The backup has budgets but no UI settings entry with their filters",
            );
        }
        const budgetUiSettings = parseBudgetUiSettings(
            archive.uiSettings,
            canonical.budgets.map((budget) => budget.id),
        );
        archive.uiSettings?.fill(0);
        const dataset = parseBackupDataset(
            createAppDataset({
                backupSha256,
                budgetUiSettings,
                canonical,
                databaseSha256,
                preferences,
                timeZone,
            }),
        );
        await writeJsonAtomically(
            outputPath,
            dataset,
            false,
            MAX_DATASET_JSON_BYTES,
        );

        return {
            accountCount: dataset.accounts.length,
            budgetCount: dataset.budgets.length,
            categoryCount: dataset.categories.length,
            outputPath,
            postingCount: dataset.postings.length,
        };
    } finally {
        archive.database.fill(0);
        archive.preferencesXml.fill(0);
        archive.uiSettings?.fill(0);
    }
}
