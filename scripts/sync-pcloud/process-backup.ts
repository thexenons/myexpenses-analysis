import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
    encryptDataset,
    type EncryptDatasetOptions,
} from "../encrypt-dataset/encrypt-dataset.ts";
import { verifyProductionVault } from "../build-static/production-vault.ts";
import { readLimitedRegularFile } from "../encrypt-dataset/files.ts";
import { STATIC_VAULT_MAX_ENVELOPE_BYTES } from "../../src/domain/security/static-vault.ts";
import {
    importBackup,
    type ImportBackupOptions,
} from "../import-backup/import-backup.ts";
import type {
    ProcessBackupInput,
    ProcessBackupResult,
} from "./orchestrator.ts";

const MAX_BUILD_OUTPUT_BYTES = 4 * 1024 * 1024;
const DEFAULT_TERMINATION_GRACE_MS = 5_000;
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
    readonly leaseFd?: number;
    readonly outputDirectory: string;
    readonly repositoryRoot: string;
    readonly signal?: AbortSignal;
    readonly vaultPath: string;
    readonly verifiedVaultSha256: string;
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
    verifiedVaultSha256?: string,
): NodeJS.ProcessEnv {
    const safeEnvironment: NodeJS.ProcessEnv = {
        MYEXPENSES_VAULT_SOURCE_PATH: vaultPath,
        NODE_ENV: "production",
        ...(verifiedVaultSha256 === undefined ? {} : { MYEXPENSES_VERIFIED_VAULT_SHA256: verifiedVaultSha256 }),
    };
    for (const key of SAFE_BUILD_ENVIRONMENT_KEYS) {
        const value = environment[key];
        if (value !== undefined) safeEnvironment[key] = value;
    }
    return safeEnvironment;
}

async function liveProcessGroupMembers(groupId: number): Promise<boolean> {
    for (const entry of await readdir("/proc")) {
        if (!/^\d+$/.test(entry)) continue;
        let stat: string;
        try {
            // oxlint-disable-next-line no-await-in-loop -- process state is sampled sequentially without unbounded reads.
            stat = await readFile(`/proc/${entry}/stat`, "utf8");
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
            throw error;
        }
        const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        if (Number(fields[2]) === groupId && fields[0] !== "Z" && fields[0] !== "X") {
            return true;
        }
    }
    return false;
}

async function groupMayStillBeLive(groupId: number): Promise<boolean> {
    try {
        return await liveProcessGroupMembers(groupId);
    } catch {
        // A transient /proc read failure is not proof that descendants exited.
        return true;
    }
}

export function executeStaticBuildChild(
    scriptPath: string,
    args: readonly string[],
    options: {
        readonly cwd: string;
        readonly env?: NodeJS.ProcessEnv;
        readonly leaseFd?: number;
        readonly signal?: AbortSignal;
        readonly terminationGraceMs?: number;
    },
): Promise<void> {
    options.signal?.throwIfAborted();
    const graceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
    if (!Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 30_000) {
        throw new StaticReleasePipelineError("Production build shutdown timing is invalid");
    }
    return new Promise((resolvePromise, reject) => {
        const child = spawn(process.execPath, [scriptPath, ...args], {
            cwd: options.cwd,
            detached: true,
            env: options.env,
            stdio: ["ignore", "pipe", "pipe", options.leaseFd ?? "ignore"],
            windowsHide: true,
        });
        let failure: Error | undefined;
        let outputBytes = 0;
        let escalation: ReturnType<typeof setTimeout> | undefined;
        const killGroup = (signal: NodeJS.Signals) => {
            if (child.pid === undefined) return;
            try { process.kill(-child.pid, signal); } catch { /* Already exited. */ }
        };
        const stop = () => {
            if (escalation !== undefined) return;
            failure = new StaticReleasePipelineError("Production build was interrupted");
            killGroup("SIGTERM");
            escalation = setTimeout(() => {
                void (async () => {
                    if (child.pid !== undefined && await groupMayStillBeLive(child.pid)) {
                        killGroup("SIGKILL");
                    }
                })();
            }, graceMs);
            escalation.unref();
        };
        const countOutput = (chunk: Buffer) => {
            outputBytes += chunk.byteLength;
            if (outputBytes > MAX_BUILD_OUTPUT_BYTES) stop();
        };
        child.stdout?.on("data", countOutput);
        child.stderr?.on("data", countOutput);
        child.once("error", () => {
            failure = new StaticReleasePipelineError("Production build could not start");
        });
        const directExit = new Promise<number | null>((resolveExit) => {
            child.once("exit", (code) => resolveExit(code));
            child.once("error", () => resolveExit(null));
        });
        const directClose = new Promise<void>((resolveClose) => {
            child.once("close", () => resolveClose());
        });
        void (async () => {
            const code = await directExit;
            if (child.pid !== undefined && await groupMayStillBeLive(child.pid)) {
                // A successful direct child may still leave writers in its process group.
                stop();
                // TERM-to-KILL escalation is bounded; ownership stays held until
                // the group stops. An uninterruptible kernel task can extend that wait.
                while (true) {
                    // oxlint-disable-next-line no-await-in-loop -- recheck the known group after each shutdown interval.
                    if (!(await groupMayStillBeLive(child.pid))) break;
                    // oxlint-disable-next-line no-await-in-loop -- wait for the known process group to cease writing.
                    await delay(25);
                }
            }
            await directClose;
            options.signal?.removeEventListener("abort", stop);
            if (escalation !== undefined) clearTimeout(escalation);
            if (failure !== undefined) reject(failure);
            else if (code !== 0) reject(new StaticReleasePipelineError("Production build failed"));
            else resolvePromise();
        })().catch((error: unknown) => {
            options.signal?.removeEventListener("abort", stop);
            if (escalation !== undefined) clearTimeout(escalation);
            reject(new StaticReleasePipelineError("Production build shutdown could not be verified", {
                cause: error,
            }));
        });
        options.signal?.addEventListener("abort", stop, { once: true });
        if (options.signal?.aborted) stop();
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
        input.verifiedVaultSha256,
    );
    await executeStaticBuildChild(TSC_PATH, ["-b"], {
        cwd: input.repositoryRoot,
        env: environment,
        leaseFd: input.leaseFd,
        signal: input.signal,
    });
    await executeStaticBuildChild(
        VITE_PATH,
        ["build", "--outDir", input.outputDirectory, "--emptyOutDir"],
        {
            cwd: input.repositoryRoot,
            env: environment,
            leaseFd: input.leaseFd,
            signal: input.signal,
        },
    );
}

async function assertSafeBuildOutput(buildDirectory: string, verifiedVaultSha256: string): Promise<void> {
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
    const emitted = await readLimitedRegularFile(expected, STATIC_VAULT_MAX_ENVELOPE_BYTES, "Emitted dataset vault");
    try {
        if (createHash("sha256").update(emitted).digest("hex") !== verifiedVaultSha256) {
            throw new StaticReleasePipelineError("Production build emitted a vault different from its authenticated source");
        }
    } finally {
        emitted.fill(0);
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
    const verifiedVaultSha256 = await verifyProductionVault(vaultPath, input.vaultPassphrase);
    signal?.throwIfAborted();
    await (dependencies.build ?? defaultBuild)({
        leaseFd: input.leaseFd,
        outputDirectory: buildDirectory,
        repositoryRoot: input.repositoryRoot,
        signal,
        vaultPath,
        verifiedVaultSha256,
    });
    await assertSafeBuildOutput(buildDirectory, verifiedVaultSha256);
    return { buildDirectory };
}
