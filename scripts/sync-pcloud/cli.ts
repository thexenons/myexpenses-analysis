import { parseArgs } from "node:util";

import { SyncConfigError } from "./config.ts";
import {
    loadSyncPCloudCliEnvironment,
    type SyncPCloudCliEnvironmentOptions,
} from "./cli-environment.ts";
import { loadSyncPCloudRuntimeConfig } from "./runtime-config.ts";
import { SyncLeaseError } from "./lease.ts";
import {
    PCloudSyncError,
    runPCloudSync,
    type PCloudSyncDependencies,
} from "./orchestrator.ts";
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
        error instanceof SyncLeaseError ||
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
    signal?: AbortSignal,
    environmentOptions: SyncPCloudCliEnvironmentOptions = {},
): Promise<number> {
    try {
        const options = parseSyncPCloudArguments(args);
        const runtime = loadSyncPCloudRuntimeConfig(
            await loadSyncPCloudCliEnvironment(environmentOptions),
        );
        const result = await runPCloudSync(
            runtime.config,
            {
                ...dependencies,
                loadSecrets: async () => runtime.secrets,
                logger: { info: (message) => io.stdout(`${message}\n`) },
            },
            { force: options.force, signal },
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
