import { spawn, execFile } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readdir, realpath, rm, stat, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TRACKED_ROOTS = [
  "src", "scripts", "tests", "patches", "deploy", "index.html", "vite.config.ts",
  "vitest.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json", "tsconfig.browser.json",
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "Dockerfile",
  ".dockerignore", ".gitignore", ".oxlintrc.json",
];
const BROWSER_SOURCES = [
  "tests/browser/financial-explainability.spec.ts",
  "tests/browser/playwright.config.ts",
  "tests/browser/synthetic-server.ts",
  "tests/browser/run-isolated.ts",
];

function isWithin(root: string, path: string): boolean {
  const rest = relative(root, path);
  return rest === "" || (rest !== ".." && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}

async function trackedSources(): Promise<string[]> {
  const output = await new Promise<string>((done, reject) => {
    execFile("git", ["ls-files", "-z", "--", ...TRACKED_ROOTS], { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : done(stdout));
  });
  return [...new Set([...output.split("\0").filter(Boolean), ...BROWSER_SOURCES])];
}

async function copySource(snapshot: string): Promise<void> {
  for (const name of await trackedSources()) {
    const source = join(ROOT, name);
    if (!isWithin(ROOT, source) || /(?:^|\/)\.env|\.(?:zip|db|sqlite|sql|vault\.json)$/iu.test(name)) {
      throw new Error(`Unsafe browser source path: ${name}`);
    }
    // oxlint-disable-next-line no-await-in-loop -- each tracked path is validated before copying.
    const entry = await lstat(source);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Browser source is not a regular file: ${name}`);
    const destination = join(snapshot, name);
    // oxlint-disable-next-line no-await-in-loop -- copy only one allowlisted tracked source at a time.
    await mkdir(dirname(destination), { recursive: true });
    // oxlint-disable-next-line no-await-in-loop -- copy only one allowlisted tracked source at a time.
    await copyFile(source, destination);
  }
}

async function linkPackage(source: string, destination: string): Promise<void> {
  const packagePath = await realpath(source);
  if (!(await stat(packagePath)).isDirectory()) return;
  await symlink(packagePath, destination);
}

async function linkInstalledPackages(snapshot: string): Promise<void> {
  const target = join(snapshot, "node_modules");
  await mkdir(target);
  for (const entry of await readdir(join(ROOT, "node_modules"), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === ".bin") continue;
    const source = join(ROOT, "node_modules", entry.name);
    if (entry.name.startsWith("@")) {
      // oxlint-disable-next-line no-await-in-loop -- scopes are small and package links are independent.
      await mkdir(join(target, entry.name));
      // oxlint-disable-next-line no-await-in-loop -- package-directory links only; never copy metadata or caches.
      for (const child of await readdir(source)) {
        // oxlint-disable-next-line no-await-in-loop -- package-directory links only.
        await linkPackage(join(source, child), join(target, entry.name, child));
      }
    } else {
      // oxlint-disable-next-line no-await-in-loop -- package-directory links only.
      await linkPackage(source, join(target, entry.name));
    }
  }
  await mkdir(join(target, ".tmp"));
  await mkdir(join(target, ".vite-temp"));
}

async function main(): Promise<void> {
  const performanceCount = process.env.MYEXPENSES_PERF_COUNT;
  if (performanceCount !== undefined && !["1000", "10000", "50000"].includes(performanceCount)) {
    throw new Error("MYEXPENSES_PERF_COUNT must be 1000, 10000, or 50000");
  }
  if (isWithin(ROOT, tmpdir())) throw new Error("Temporary directory must be outside the repository");
  const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), ".cache", "ms-playwright");
  if (!isAbsolute(browserPath) || isWithin(ROOT, browserPath)) throw new Error("Browser cache must be outside the repository");
  const runtimeLib = process.env.MYEXPENSES_BROWSER_RUNTIME_LIB_DIR;
  if (runtimeLib !== undefined && (!isAbsolute(runtimeLib) || isWithin(ROOT, runtimeLib))) {
    throw new Error("Browser runtime library directory must be outside the repository");
  }
  const temporary = await mkdtemp(join(tmpdir(), "myexpenses-browser-source-"));
  const snapshot = join(temporary, "source");
  try {
    await mkdir(snapshot);
    await mkdir(join(temporary, "home"));
    await mkdir(join(temporary, "tmp"));
    await copySource(snapshot);
    await linkInstalledPackages(snapshot);
    const child = spawn(process.execPath, [
      join(snapshot, "node_modules/@playwright/test/cli.js"), "test",
      "--config", "tests/browser/playwright.config.ts", ...process.argv.slice(2),
    ], {
      cwd: snapshot,
      env: {
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
        HOME: join(temporary, "home"), TMPDIR: join(temporary, "tmp"),
        CI: "true", TZ: "Europe/Madrid", COREPACK_ENABLE_NETWORK: "0",
        PLAYWRIGHT_BROWSERS_PATH: browserPath,
        ...(runtimeLib === undefined ? {} : { MYEXPENSES_BROWSER_RUNTIME_LIB_DIR: runtimeLib }),
        ...(performanceCount === undefined ? {} : { MYEXPENSES_PERF_COUNT: performanceCount }),
      },
      stdio: "inherit",
    });
    const forwardSignal = (signal: NodeJS.Signals) => child.kill(signal);
    const onInterrupt = () => forwardSignal("SIGINT");
    const onTerminate = () => forwardSignal("SIGTERM");
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    try {
      process.exitCode = await new Promise<number>((done, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => done(code ?? 1));
      });
    } finally {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

await main();
