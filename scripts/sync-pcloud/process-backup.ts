import { execFile } from "node:child_process";
import { lstat, readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    encryptDataset,
    type EncryptDatasetOptions,
} from "../encrypt-dataset/encrypt-dataset.ts";
import {
    importBackup,
    type ImportBackupOptions,
} from "../import-backup/import-backup.ts";
import type {
    ProcessBackupInput,
    ProcessBackupResult,
} from "./orchestrator.ts";

const MAX_BUILD_OUTPUT_BYTES = 4 * 1024 * 1024;
const EXPECTED_PACKAGE_NAME = "myexpenses-analysis";
const TSC_PATH = fileURLToPath(
    new URL("../../node_modules/typescript/bin/tsc", import.meta.url),
);
const VITE_PATH = fileURLToPath(
    new URL("../../node_modules/vite/bin/vite.js", import.meta.url),
);
const SAFE_BUILD_ENVIRONMENT_KEYS = [
    "CI",
    "HOME",
    "LANG",
    "LC_ALL",
    "NO_COLOR",
    "PATH",
    "SOURCE_DATE_EPOCH",
    "TMPDIR",
    "TZ",
] as const;

export interface StaticReleaseBuildInput {
    readonly outputDirectory: string;
    readonly repositoryRoot: string;
    readonly signal?: AbortSignal;
    readonly vaultPath: string;
}

export interface ProcessBackupDependencies {
    readonly build?: (input: StaticReleaseBuildInput) => Promise<void>;
    readonly encrypt?: (
        options: EncryptDatasetOptions,
    ) => Promise<unknown>;
    readonly import?: (options: ImportBackupOptions) => Promise<unknown>;
}

class StaticReleasePipelineError extends Error {
    override readonly name = "StaticReleasePipelineError";
}

/**
 * Keeps pCloud credentials and the vault passphrase out of the child-process
 * environment. Only process settings needed for a portable build cross this
 * boundary.
 */
export function createStaticBuildEnvironment(
    environment: NodeJS.ProcessEnv,
    vaultPath: string,
): NodeJS.ProcessEnv {
    const safeEnvironment: NodeJS.ProcessEnv = {
        MYEXPENSES_VAULT_SOURCE_PATH: vaultPath,
        NODE_ENV: "production",
    };
    for (const key of SAFE_BUILD_ENVIRONMENT_KEYS) {
        const value = environment[key];
        if (value !== undefined) safeEnvironment[key] = value;
    }
    return safeEnvironment;
}

function executeNode(
    scriptPath: string,
    args: readonly string[],
    options: {
        readonly cwd: string;
        readonly env?: NodeJS.ProcessEnv;
        readonly signal?: AbortSignal;
    },
): Promise<void> {
    return new Promise((resolvePromise, reject) => {
        execFile(
            process.execPath,
            [scriptPath, ...args],
            {
                cwd: options.cwd,
                env: options.env,
                maxBuffer: MAX_BUILD_OUTPUT_BYTES,
                signal: options.signal,
                windowsHide: true,
            },
            (error) => (error === null ? resolvePromise() : reject(error)),
        );
    });
}

async function assertRepositoryRoot(repositoryRoot: string): Promise<void> {
    const packagePath = join(repositoryRoot, "package.json");
    let value: unknown;
    try {
        value = JSON.parse(await readFile(packagePath, "utf8")) as unknown;
    } catch (error) {
        throw new StaticReleasePipelineError(
            "Repository root does not contain a readable package manifest",
            { cause: error },
        );
    }
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        !("name" in value) ||
        value.name !== EXPECTED_PACKAGE_NAME
    ) {
        throw new StaticReleasePipelineError(
            "Repository package manifest does not match this application",
        );
    }
}

async function defaultBuild(input: StaticReleaseBuildInput): Promise<void> {
    const environment = createStaticBuildEnvironment(
        process.env,
        input.vaultPath,
    );
    await executeNode(TSC_PATH, ["-b"], {
        cwd: input.repositoryRoot,
        env: environment,
        signal: input.signal,
    });
    await executeNode(
        VITE_PATH,
        ["build", "--outDir", input.outputDirectory, "--emptyOutDir"],
        {
            cwd: input.repositoryRoot,
            env: environment,
            signal: input.signal,
        },
    );
}

async function assertSafeBuildOutput(buildDirectory: string): Promise<void> {
    const expected = join(
        buildDirectory,
        "data",
        "app-dataset.vault.json",
    );
    const vault = await lstat(expected).catch((error: unknown) => {
        throw new StaticReleasePipelineError(
            "Production build did not emit the encrypted dataset vault",
            { cause: error },
        );
    });
    if (!vault.isFile() || vault.isSymbolicLink() || vault.size < 1) {
        throw new StaticReleasePipelineError(
            "Production build emitted an unsafe dataset vault",
        );
    }
    const dataFiles = await readdir(join(buildDirectory, "data"));
    if (
        dataFiles.length !== 1 ||
        dataFiles[0] !== "app-dataset.vault.json"
    ) {
        throw new StaticReleasePipelineError(
            "Production build contains an unexpected private data artifact",
        );
    }
    const index = await lstat(join(buildDirectory, "index.html")).catch(
        (error: unknown) => {
            throw new StaticReleasePipelineError(
                "Production build is missing index.html",
                { cause: error },
            );
        },
    );
    if (!index.isFile() || index.isSymbolicLink()) {
        throw new StaticReleasePipelineError(
            "Production build index.html is unsafe",
        );
    }
}

/** Imports, encrypts and builds entirely inside the orchestrator's 0700 workspace. */
export async function processBackupForStaticRelease(
    input: ProcessBackupInput,
    signal?: AbortSignal,
    dependencies: ProcessBackupDependencies = {},
): Promise<ProcessBackupResult> {
    signal?.throwIfAborted();
    await assertRepositoryRoot(input.repositoryRoot);
    const datasetPath = resolve(input.workspacePath, "app-dataset.json");
    const vaultPath = resolve(
        input.workspacePath,
        "app-dataset.vault.json",
    );
    const buildDirectory = resolve(input.workspacePath, "static-release");

    await (dependencies.import ?? importBackup)({
        inputPath: input.backupPath,
        outputPath: datasetPath,
        timeZone: input.timeZone,
    });
    signal?.throwIfAborted();
    await (dependencies.encrypt ?? encryptDataset)({
        inputPath: datasetPath,
        outputPath: vaultPath,
        passphrase: input.vaultPassphrase,
    });
    await unlink(datasetPath);
    signal?.throwIfAborted();
    await (dependencies.build ?? defaultBuild)({
        outputDirectory: buildDirectory,
        repositoryRoot: input.repositoryRoot,
        signal,
        vaultPath,
    });
    await assertSafeBuildOutput(buildDirectory);
    return { buildDirectory };
}
