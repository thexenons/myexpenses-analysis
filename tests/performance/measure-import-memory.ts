import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdtemp, open, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { arch, platform, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { BackupDatasetV1 } from "../../src/domain/analytics/backup-dataset.types.ts";
import { summarizeSamples } from "./summary.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const MIB = 1024 * 1024;
const limits = { archiveBytes: 64 * MIB, databaseBytes: 128 * MIB, expandedBytes: 512 * MIB };
interface Options { counts: number[]; warmups: number; repeats: number; timeoutMs: number; output: string }
interface Request { role: "fixture" | "import"; directory: string; count: number; timeoutMs: number }
interface BaseResult { role: Request["role"]; count: number; peakRssBytes: number; pid: number }
interface FixtureResult extends BaseResult {
  role: "fixture"; generationMs: number; archiveBytes: number; databaseBytes: number; expandedBytes: number;
}
interface ImportResult extends BaseResult {
  role: "import"; importMs: number; postingCount: number; accountCount: number;
  categoryCount: number; budgetCount: number; amountHomeMinor: number; checksum: string; outputBytes: number;
}
type ChildResult = FixtureResult | ImportResult;
type MeasuredResult = ChildResult & { roundTripMs: number };
type Runner = (request: Request) => Promise<MeasuredResult>;

function integer(value: string, min: number, max: number): number {
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`Expected an integer between ${min} and ${max}`);
  }
  return Number(value);
}

export function parseArguments(args: readonly string[]): Options {
  const entries = new Map<string, string>();
  for (const argument of args) {
    const match = /^--(counts|warmups|repeats|timeout-ms|output)=(.+)$/u.exec(argument);
    if (!match || entries.has(match[1]!)) throw new Error("Unknown or duplicate synthetic measurement argument");
    entries.set(match[1]!, match[2]!);
  }
  const counts = (entries.get("counts") ?? "1000,10000,50000").split(",").map((value) => integer(value, 1, 50_000));
  if (counts.length > 3 || new Set(counts).size !== counts.length) throw new Error("Use at most three distinct counts");
  return { counts, warmups: integer(entries.get("warmups") ?? "1", 0, 2),
    repeats: integer(entries.get("repeats") ?? "3", 1, 5),
    timeoutMs: integer(entries.get("timeout-ms") ?? "600000", 1_000, 600_000),
    output: entries.get("output") ?? join(tmpdir(), `myexpenses-import-memory-${randomUUID()}.json`) };
}

function outside(root: string, path: string): boolean {
  const rest = relative(root, path);
  return rest === ".." || rest.startsWith(`..${sep}`) || isAbsolute(rest);
}

export async function validateOutput(output: string): Promise<void> {
  if (!isAbsolute(output) || !outside(ROOT, output) || !outside(await realpath(ROOT), join(await realpath(dirname(output)), "report"))) {
    throw new Error("Output must be an absolute path outside the repository, including symlink parents");
  }
}

export function validateChildResult(value: unknown, role: Request["role"], count: number): ChildResult {
  if (typeof value !== "object" || value === null) throw new Error("Missing child result");
  const row = value as Record<string, unknown>;
  const numbers = role === "fixture" ? ["archiveBytes", "databaseBytes", "expandedBytes"]
    : ["postingCount", "accountCount", "categoryCount", "budgetCount", "outputBytes"];
  if (row.role !== role || row.count !== count ||
      !["peakRssBytes", "pid", ...numbers].every((key) => Number.isSafeInteger(row[key]) && Number(row[key]) > 0) ||
      typeof row[role === "fixture" ? "generationMs" : "importMs"] !== "number" ||
      !Number.isFinite(row[role === "fixture" ? "generationMs" : "importMs"]) || Number(row[role === "fixture" ? "generationMs" : "importMs"]) < 0) {
    throw new Error("Invalid child counts or resource metrics");
  }
  if (role === "import" && (row.postingCount !== count || row.amountHomeMinor !== Math.floor(count / 2) * 100 - count % 2 * 100 ||
      typeof row.checksum !== "string" || !/^[a-f0-9]{64}$/u.test(row.checksum))) throw new Error("Invalid synthetic count or financial checksum");
  if (role === "fixture" && (Number(row.databaseBytes) > Number(row.expandedBytes) ||
      numbers.some((key) => Number(row[key]) > limits[key as keyof typeof limits]))) throw new Error("Synthetic fixture exceeds existing archive limits");
  return value as ChildResult;
}

export function fixtureStatements(count: number): string[] {
  const statements = ["DELETE FROM transactions_tags", "DELETE FROM equivalent_amounts", "DELETE FROM transactions"];
  // Large single VALUES statements can overflow sql.js/WASM; bounded setup batches are not import limits.
  for (let first = 0; first < count; first += 1_000) {
    const rows = Array.from({ length: Math.min(1_000, count - first) }, (_, offset) => {
      const index = first + offset;
      return `(${index + 1}, '90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}', 1787425493, 1787425493, ${index % 2 === 0 ? -100 : 200}, ${index % 2 === 0 ? 10 : 11}, 1, NULL, 0, 'RECONCILED')`;
    });
    statements.push(`INSERT INTO transactions (_id, uuid, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES ${rows.join(",")}`);
  }
  return statements;
}

async function worker(request: Request): Promise<ChildResult> {
  const archive = join(request.directory, "synthetic.zip");
  const output = join(request.directory, "import.json");
  if (request.role === "fixture") {
    const { createImportDatabaseFixture, createBackupZipFixture, SAFE_PREFERENCES_XML_FIXTURE } = await import("../../scripts/import-backup/test-fixtures.ts");
    const start = performance.now();
    const database = await createImportDatabaseFixture({ extraSql: fixtureStatements(request.count) });
    const zip = await createBackupZipFixture({ database });
    await writeFile(archive, zip, { flag: "wx", mode: 0o600 });
    return { role: "fixture", count: request.count, generationMs: performance.now() - start,
      archiveBytes: zip.byteLength, databaseBytes: database.byteLength,
      expandedBytes: database.byteLength + Buffer.byteLength(SAFE_PREFERENCES_XML_FIXTURE),
      peakRssBytes: process.resourceUsage().maxRSS * 1024, pid: process.pid };
  }
  const { importBackup } = await import("../../scripts/import-backup/import-backup.ts");
  const start = performance.now();
  const result = await importBackup({ inputPath: archive, outputPath: output, timeZone: "Europe/Madrid",
    backupFilenameTimestamp: "20260822210453", importedAt: "2026-08-23T10:00:00.000Z" });
  const importMs = performance.now() - start;
  // Capture the process high-water mark through import before rereading output for assertions.
  const peakRssBytes = process.resourceUsage().maxRSS * 1024;
  const bytes = await readFile(output);
  const dataset = JSON.parse(bytes.toString("utf8")) as BackupDatasetV1;
  if (dataset.postings.length !== result.postingCount) throw new Error("Imported output count mismatch");
  await rm(output);
  return { role: "import", count: request.count, importMs, peakRssBytes, pid: process.pid,
    postingCount: result.postingCount, accountCount: result.accountCount, categoryCount: result.categoryCount,
    budgetCount: result.budgetCount, outputBytes: bytes.byteLength,
    amountHomeMinor: dataset.postings.reduce((sum, posting) => sum + posting.amountHomeMinor, 0),
    checksum: createHash("sha256").update(bytes).digest("hex") };
}

function runChild(request: Request): Promise<MeasuredResult> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn(process.execPath, ["--import", fileURLToPath(import.meta.resolve("tsx")), SCRIPT, "--internal-child"],
      { shell: false, stdio: ["ignore", "ignore", "ignore", "ipc"], timeout: request.timeoutMs });
    let value: unknown;
    child.once("message", (message) => { value = message; });
    child.once("error", reject);
    child.once("close", (code) => {
      try {
        if (code !== 0) {
          const detail = typeof value === "object" && value !== null && "error" in value ? String(value.error) : "no result (possibly timeout)";
          throw new Error(`Synthetic ${request.role} child failed for ${request.count} transactions: ${detail}`);
        }
        resolve({ ...validateChildResult(value, request.role, request.count), roundTripMs: performance.now() - start });
      } catch (error) { reject(error); }
    });
    child.send(request, (error) => { if (error) child.kill(); });
  });
}

/* oxlint-disable no-await-in-loop -- Sequential fresh processes avoid competing memory workloads and ensure cleanup. */
export async function measure(options: Options, runner: Runner = runChild) {
  await validateOutput(options.output);
  const temporaryRoot = await realpath(tmpdir());
  if (!outside(await realpath(ROOT), temporaryRoot)) throw new Error("Temporary fixtures must remain outside the repository");
  const handle = await open(options.output, "wx", 0o600);
  let complete = false;
  const runs: { fixture: FixtureResult; warmups: (ImportResult & { roundTripMs: number })[];
    samples: (ImportResult & { roundTripMs: number })[] }[] = [];
  try {
    for (const count of options.counts) {
      const directory = await mkdtemp(join(temporaryRoot, "myexpenses-import-memory-"));
      try {
        await chmod(directory, 0o700);
        // Each generator is separate from every measured importer and from other sizes.
        const fixture = await runner({ role: "fixture", directory, count, timeoutMs: options.timeoutMs });
        if (fixture.role !== "fixture") throw new Error("Unexpected fixture result");
        const warmups: (ImportResult & { roundTripMs: number })[] = [];
        const samples: (ImportResult & { roundTripMs: number })[] = [];
        for (let index = 0; index < options.warmups + options.repeats; index++) {
          const sample = await runner({ role: "import", directory, count, timeoutMs: options.timeoutMs });
          if (sample.role !== "import") throw new Error("Unexpected import result");
          (index < options.warmups ? warmups : samples).push(sample);
        }
        if (new Set([...warmups, ...samples].map((sample) => sample.checksum)).size !== 1) throw new Error("Output checksum changed between fresh imports");
        runs.push({ fixture, warmups, samples });
      } finally { await rm(directory, { recursive: true, force: true }); }
    }
    const summary = (values: readonly number[]) => {
      const result = summarizeSamples(values);
      return { median: result.medianMs, min: result.minMs, max: result.maxMs };
    };
    const report = { schemaVersion: 1, node: process.version, platform: platform(), architecture: arch(),
      maxRssUnits: "bytes (Node resourceUsage.maxRSS KiB multiplied by 1024)", limits,
      childTimeoutMs: options.timeoutMs,
      cleanupComplete: true, runs: runs.map((run) => ({ fixture: run.fixture, warmups: run.warmups, samples: run.samples,
        summary: { importMs: summary(run.samples.map((sample) => sample.importMs)),
          roundTripMs: summary(run.samples.map((sample) => sample.roundTripMs)),
          peakRssBytes: summary(run.samples.map((sample) => sample.peakRssBytes)) } })) };
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`);
    complete = true;
    return report;
  } finally {
    await handle.close();
    if (!complete) await rm(options.output, { force: true });
  }
}

/* oxlint-enable no-await-in-loop */

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === "--internal-child" && process.send !== undefined) {
    process.once("message", (request: Request) => {
      worker(request).then((result) => process.send!(result, () => process.disconnect!()), (error: unknown) => {
        process.exitCode = 1;
        process.send!({ error: error instanceof Error ? error.message : "Unknown synthetic child error" }, () => process.disconnect!());
      });
    });
  } else {
    measure(parseArguments(process.argv.slice(2))).then((report) => {
      console.log(JSON.stringify(report));
    }, (error: unknown) => { console.error(error instanceof Error ? error.message : "Synthetic import measurement failed"); process.exitCode = 1; });
  }
}
