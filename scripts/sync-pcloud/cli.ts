import { isAbsolute } from "node:path";
import { parseArgs } from "node:util";

import {
    loadSyncPCloudConfig,
    SyncConfigError,
} from "./config.ts";
import {
    PCloudSyncError,
    runPCloudSync,
    type PCloudSyncDependencies,
} from "./orchestrator.ts";
import { PCloudError } from "./pcloud.ts";

export interface SyncPCloudCliOptions {
    readonly configPath: string;
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
            config: { type: "string" },
            force: { default: false, type: "boolean" },
        },
        strict: true,
    });
    if (
        values.config === undefined ||
        values.config.length === 0 ||
        !isAbsolute(values.config)
    ) {
        throw new SyncConfigError("--config must be an absolute path");
    }
    return { configPath: values.config, force: values.force };
}

function publicError(error: unknown): string {
    if (
        error instanceof SyncConfigError ||
        error instanceof PCloudError ||
        error instanceof PCloudSyncError
    ) {
        return error.message;
    }
    return "The backup processing pipeline failed";
}

/**
 * Root integration supplies processBackup, which must run importBackup, static
 * vault encryption and the production build inside the provided workspace.
 */
export async function runSyncPCloudCli(
    args: readonly string[],
    dependencies: PCloudSyncDependencies,
    io: SyncPCloudCliIo = {
        stderr: (message) => process.stderr.write(message),
        stdout: (message) => process.stdout.write(message),
    },
): Promise<number> {
    try {
        const options = parseSyncPCloudArguments(args);
        const config = await loadSyncPCloudConfig(options.configPath);
        const result = await runPCloudSync(
            config,
            {
                ...dependencies,
                logger: { info: (message) => io.stdout(`${message}\n`) },
            },
            { force: options.force },
        );
        if (result.status === "noop") {
            io.stdout("Synchronization completed without changes.\n");
        } else {
            io.stdout("Synchronization and atomic publication completed.\n");
        }
        return 0;
    } catch (error) {
        io.stderr(`Synchronization failed: ${publicError(error)}.\n`);
        return 1;
    }
}
