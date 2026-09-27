import { lstat, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readPassphraseFile, readHiddenPassphrase } from "../encrypt-dataset/passphrase.ts";
import { DatasetEncryptionError } from "../encrypt-dataset/errors.ts";
import { createStaticBuildEnvironment, executeStaticBuildChild } from "../sync-pcloud/process-backup.ts";
import { StaticVaultValidationError } from "../../src/domain/security/static-vault.ts";
import { verifyProductionVault } from "./production-vault.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DEFAULT_OUTPUT_DIRECTORY = resolve(ROOT, "dist");
const TSC = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));
const VITE = fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url));

export interface BuildStaticDependencies {
  readonly prompt?: () => Promise<string>;
  readonly readPassphraseFile?: (path: string) => Promise<string>;
  readonly runBuild?: (vaultPath: string, outputDirectory: string, verifiedVaultSha256: string) => Promise<void>;
  readonly stderr?: (message: string) => void;
}

async function defaultBuild(vaultPath: string, outputDirectory: string, verifiedVaultSha256: string): Promise<void> {
  const env = createStaticBuildEnvironment(process.env, vaultPath, verifiedVaultSha256);
  await executeStaticBuildChild(TSC, ["-b"], { cwd: ROOT, env });
  await executeStaticBuildChild(VITE, viteBuildArguments(outputDirectory), { cwd: ROOT, env });
}

export function viteBuildArguments(outputDirectory: string): readonly string[] {
  // Vite clears the default in-root dist itself; never force clearing an arbitrary path.
  return ["build", "--outDir", outputDirectory];
}

function containsPath(parent: string, child: string): boolean {
  const remainder = relative(parent, child);
  return remainder === "" || (remainder !== ".." && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder));
}

async function assertSafeOutputDirectory(outputDirectory: string, vaultPath: string, passphraseFilePath?: string): Promise<void> {
  if (containsPath(outputDirectory, ROOT) ||
      containsPath(outputDirectory, vaultPath) ||
      (passphraseFilePath !== undefined && containsPath(outputDirectory, passphraseFilePath)) ||
      (outputDirectory !== DEFAULT_OUTPUT_DIRECTORY && containsPath(ROOT, outputDirectory))) {
    throw new Error("Unsafe production output directory");
  }

  let current = outputDirectory;
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- inspect each path component until the filesystem root.
    const entry = await lstat(current).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    });
    if (entry !== undefined && (!entry.isDirectory() || entry.isSymbolicLink())) {
      throw new Error("Unsafe production output directory");
    }
    if (current === outputDirectory && entry !== undefined &&
        // oxlint-disable-next-line no-await-in-loop -- only the selected output directory can be checked for existing files.
        outputDirectory !== DEFAULT_OUTPUT_DIRECTORY && (await readdir(current)).length > 0) {
      throw new Error("Custom production output directory must be empty");
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export async function runBuildStaticCli(args: readonly string[], dependencies: BuildStaticDependencies = {}): Promise<number> {
  const stderr = dependencies.stderr ?? ((message: string) => process.stderr.write(message));
  try {
    const { values } = parseArgs({
      args: args.filter((arg) => arg !== "--"),
      allowPositionals: false,
      strict: true,
      options: {
        "passphrase-file": { type: "string" },
        "vault": { type: "string", default: "data/app-dataset.vault.json" },
        "out-dir": { type: "string", default: "dist" },
      },
    });
    if (!values.vault.trim() || !values["out-dir"].trim() || values["passphrase-file"]?.trim() === "") {
      throw new Error("Build paths must not be empty");
    }
    const vaultPath = resolve(values.vault);
    const outputDirectory = resolve(values["out-dir"]);
    await assertSafeOutputDirectory(outputDirectory, vaultPath,
      values["passphrase-file"] === undefined ? undefined : resolve(values["passphrase-file"]));
    const passphrase = values["passphrase-file"] === undefined
      ? await (dependencies.prompt ?? (() => readHiddenPassphrase("Vault passphrase: ")))()
      : await (dependencies.readPassphraseFile ?? readPassphraseFile)(values["passphrase-file"]);
    // Never trust a digest inherited from the caller; compute a fresh binding after authentication.
    const verifiedVaultSha256 = await verifyProductionVault(vaultPath, passphrase);
    await (dependencies.runBuild ?? defaultBuild)(vaultPath, outputDirectory, verifiedVaultSha256);
    return 0;
  } catch (error) {
    const reason = error instanceof DatasetEncryptionError || error instanceof StaticVaultValidationError
      ? error.message
      : error instanceof Error && error.message === "Production vault authentication failed"
        ? error.message
        : "check build inputs and tooling";
    stderr(`Production build failed: ${reason}.\n`);
    return 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
  process.exitCode = await runBuildStaticCli(process.argv.slice(2));
}
