import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
    importBackup,
    type ImportBackupOptions,
    type ImportBackupResult,
} from "./import-backup.ts";
import { BackupArchiveError } from "./archive.ts";
import { BackupDatabaseError } from "./database.ts";
import {
    findLatestBackupFile,
    LatestBackupError,
} from "./latest-backup.ts";
import { BackupPreferencesError } from "./preferences.ts";

const DEFAULT_INPUT_DIRECTORY = "data";
const DEFAULT_OUTPUT_PATH = "data/app-dataset.json";
const DEFAULT_TIME_ZONE = "Europe/Madrid";

interface ImportBackupCliSharedArguments {
    readonly outputPath: string;
    readonly timeZone: string;
}

export type ImportBackupCliArguments = ImportBackupCliSharedArguments &
    (
        | {
              readonly inputDirectoryPath: string;
              readonly inputPath?: never;
          }
        | {
              readonly inputDirectoryPath?: never;
              readonly inputPath: string;
          }
    );

export interface ImportBackupCliIo {
    stderr: (message: string) => void;
    stdout: (message: string) => void;
}

type ImportBackupImplementation = (
    options: ImportBackupOptions,
) => Promise<ImportBackupResult>;

export interface ImportBackupCliDependencies {
    readonly findLatestBackup?: (directoryPath: string) => Promise<string>;
    readonly importBackup?: ImportBackupImplementation;
}

class ImportBackupCliError extends Error {
    override readonly name = "ImportBackupCliError";
}

function publicError(error: unknown): string {
    if (
        error instanceof ImportBackupCliError ||
        error instanceof LatestBackupError ||
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
): ImportBackupCliArguments {
    // pnpm/npm may forward the conventional separator to the child process.
    const forwardedArgs = args[0] === "--" ? args.slice(1) : args;
    const { values } = parseArgs({
        allowPositionals: false,
        args: [...forwardedArgs],
        options: {
            input: { type: "string" },
            "input-directory": { type: "string" },
            output: { default: DEFAULT_OUTPUT_PATH, type: "string" },
            "time-zone": { default: DEFAULT_TIME_ZONE, type: "string" },
        },
        strict: true,
    });
    if (values.input !== undefined && values.input.trim().length === 0) {
        throw new ImportBackupCliError("--input must not be empty");
    }
    if (
        values["input-directory"] !== undefined &&
        values["input-directory"].trim().length === 0
    ) {
        throw new ImportBackupCliError("--input-directory must not be empty");
    }
    if (values.input !== undefined && values["input-directory"] !== undefined) {
        throw new ImportBackupCliError(
            "Use either --input or --input-directory, not both",
        );
    }
    if (values["time-zone"].trim().length === 0) {
        throw new ImportBackupCliError("--time-zone must not be empty");
    }
    if (values.output.trim().length === 0) {
        throw new ImportBackupCliError("--output must not be empty");
    }
    return {
        ...(values.input === undefined
            ? {
                  inputDirectoryPath:
                      values["input-directory"] ?? DEFAULT_INPUT_DIRECTORY,
              }
            : { inputPath: values.input }),
        outputPath: values.output,
        timeZone: values["time-zone"],
    };
}

export async function runImportBackupCli(
    args: readonly string[],
    dependencies: ImportBackupCliDependencies = {},
    io: ImportBackupCliIo = {
        stderr: (message) => process.stderr.write(message),
        stdout: (message) => process.stdout.write(message),
    },
): Promise<number> {
    try {
        const parsed = parseImportBackupArguments(args);
        const inputPath =
            parsed.inputPath ??
            (await (dependencies.findLatestBackup ?? findLatestBackupFile)(
                parsed.inputDirectoryPath,
            ));
        const result = await (dependencies.importBackup ?? importBackup)({
            inputPath,
            outputPath: parsed.outputPath,
            timeZone: parsed.timeZone,
        });
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
