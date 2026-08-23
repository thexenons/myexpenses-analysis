import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
    importBackup,
    type ImportBackupOptions,
    type ImportBackupResult,
} from "./import-backup.ts";
import { BackupArchiveError } from "./archive.ts";
import { BackupDatabaseError } from "./database.ts";
import { BackupPreferencesError } from "./preferences.ts";

const DEFAULT_OUTPUT_PATH = "data/app-dataset.json";

export interface ImportBackupCliIo {
    stderr: (message: string) => void;
    stdout: (message: string) => void;
}

type ImportBackupImplementation = (
    options: ImportBackupOptions,
) => Promise<ImportBackupResult>;

class ImportBackupCliError extends Error {
    override readonly name = "ImportBackupCliError";
}

function publicError(error: unknown): string {
    if (
        error instanceof ImportBackupCliError ||
        error instanceof BackupArchiveError ||
        error instanceof BackupDatabaseError ||
        error instanceof BackupPreferencesError
    ) {
        return error.message;
    }
    return "Backup import failed validation";
}

export function parseImportBackupArguments(
    args: readonly string[],
): ImportBackupOptions {
    // pnpm/npm may forward the conventional separator to the child process.
    const forwardedArgs = args[0] === "--" ? args.slice(1) : args;
    const { values } = parseArgs({
        allowPositionals: false,
        args: [...forwardedArgs],
        options: {
            input: { type: "string" },
            output: { default: DEFAULT_OUTPUT_PATH, type: "string" },
            "time-zone": { type: "string" },
        },
        strict: true,
    });
    if (values.input === undefined || values.input.trim().length === 0) {
        throw new ImportBackupCliError("--input is required");
    }
    if (
        values["time-zone"] === undefined ||
        values["time-zone"].trim().length === 0
    ) {
        throw new ImportBackupCliError("--time-zone is required");
    }
    if (values.output.trim().length === 0) {
        throw new ImportBackupCliError("--output must not be empty");
    }
    return {
        inputPath: values.input,
        outputPath: values.output,
        timeZone: values["time-zone"],
    };
}

export async function runImportBackupCli(
    args: readonly string[],
    implementation: ImportBackupImplementation = importBackup,
    io: ImportBackupCliIo = {
        stderr: (message) => process.stderr.write(message),
        stdout: (message) => process.stdout.write(message),
    },
): Promise<number> {
    try {
        const result = await implementation(parseImportBackupArguments(args));
        io.stdout(
            `Import complete: ${result.accountCount} accounts, ` +
                `${result.categoryCount} categories, ` +
                `${result.postingCount} postings, ` +
                `${result.budgetCount} budgets.\n`,
        );
        return 0;
    } catch (error) {
        io.stderr(`Import failed: ${publicError(error)}\n`);
        return 1;
    }
}

const entryPoint = process.argv[1];
if (
    entryPoint !== undefined &&
    import.meta.url === pathToFileURL(entryPoint).href
) {
    process.exitCode = await runImportBackupCli(process.argv.slice(2));
}
