import { parseArgs } from "node:util";

import { SyncConfigError } from "./config.ts";
import {
    loadSyncPCloudCliEnvironment,
    type SyncPCloudCliEnvironmentOptions,
} from "./cli-environment.ts";
import { loadPCloudSourceConfig } from "./source-config.ts";
import {
    LocalBackupError,
    downloadLatestPCloudBackup,
    type LocalBackupDependencies,
} from "./local-download.ts";
import { PCloudError } from "./pcloud.ts";

export interface SyncPCloudCliOptions {
    readonly force: boolean;
}

export interface SyncPCloudCliIo {
    readonly stderr: (message: string) => void;
    readonly stdout: (message: string) => void;
}

export function parseSyncPCloudArguments(
    argsInput: readonly string[],
): SyncPCloudCliOptions {
    const args = argsInput[0] === "--" ? argsInput.slice(1) : argsInput;
    const { values } = parseArgs({
        allowPositionals: false,
        args: [...args],
        options: {
            force: { default: false, type: "boolean" },
        },
        strict: true,
    });
    return { force: values.force };
}

function publicError(error: unknown): string {
    if (
        error instanceof SyncConfigError ||
        error instanceof PCloudError ||
        error instanceof LocalBackupError
    ) {
        return error.message;
    }
    return "The local backup download failed";
}

export async function runSyncPCloudCli(
    args: readonly string[],
    dependencies: LocalBackupDependencies = {},
    io: SyncPCloudCliIo = {
        stderr: (message) => process.stderr.write(message),
        stdout: (message) => process.stdout.write(message),
    },
    signal?: AbortSignal,
    environmentOptions: SyncPCloudCliEnvironmentOptions = {},
): Promise<number> {
    try {
        const options = parseSyncPCloudArguments(args);
        const source = loadPCloudSourceConfig(
            await loadSyncPCloudCliEnvironment(environmentOptions),
        );
        const result = await downloadLatestPCloudBackup(source, dependencies, {
            cwd: environmentOptions.cwd ?? process.cwd(),
            force: options.force,
            signal,
        });
        io.stdout(result === "noop"
            ? "Latest backup is already present in data/ and its checksum matches.\n"
            : "Latest backup downloaded to data/.\n");
        return 0;
    } catch (error) {
        io.stderr(`Backup download failed: ${publicError(error)}.\n`);
        return 1;
    }
}
