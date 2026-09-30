import { createServer } from "node:http";
import { chmod, copyFile, lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { createBackupZipFixture, createImportDatabaseFixture } from "../../scripts/import-backup/test-fixtures.ts";
import { importBackup } from "../../scripts/import-backup/import-backup.ts";
import { encryptDataset } from "../../scripts/encrypt-dataset/encrypt-dataset.ts";
import { runBuildStaticCli } from "../../scripts/build-static/cli.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import { createImportedHistorySeed, makeSyntheticHistory } from "../performance/synthetic-history.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 41789;
const PASSPHRASE = "synthetic-browser-only-passphrase";
const REVISION = "b".repeat(40);
const APP_ROUTES = new Set([
  "/", "/resumen", "/flujo-de-caja", "/comparativa", "/deudas",
  "/presupuestos", "/categorias", "/cuentas", "/patrones", "/transacciones",
]);

async function assertIsolatedSource(): Promise<void> {
  for (const forbidden of [".git", "data", "public", "backups", ".env"]) {
    // oxlint-disable-next-line no-await-in-loop -- fail before reading any source or building.
    const found = await lstat(join(ROOT, forbidden)).then(() => true, () => false);
    if (found) throw new Error(`Browser tests require a source-only snapshot (found ${forbidden})`);
  }
  for (const location of [process.env.HOME, process.env.TMPDIR]) {
    if (location === undefined || !isAbsolute(location) || !relative(ROOT, location).startsWith("..")) {
      throw new Error("HOME and TMPDIR must be outside the source snapshot");
    }
  }
}

function within(root: string, path: string): boolean {
  const rest = relative(root, path);
  return rest === "" || (rest !== ".." && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}

async function main(): Promise<void> {
  await assertIsolatedSource();
  const temporary = await mkdtemp(join(tmpdir(), "myexpenses-browser-"));
  await chmod(temporary, 0o700);
  const archivePath = join(temporary, "myexpenses-backup-20260822-210453.zip");
  const datasetPath = join(temporary, "app-dataset.json");
  const vaultPath = join(temporary, "app-dataset.vault.json");
  const legacyDatasetPath = join(temporary, "legacy-dataset.json");
  const legacyVaultPath = join(temporary, "legacy.vault.json");
  const noLimitArchivePath = join(temporary, "u3-budget-backup.zip");
  const noLimitDatasetPath = join(temporary, "u3-budget-dataset.json");
    const noLimitVaultPath = join(temporary, "u3-budget.vault.json");
    const transactionArchivePath = join(temporary, "u6-transactions-backup.zip");
    const transactionDatasetPath = join(temporary, "u6-transactions-dataset.json");
    const transactionVaultPath = join(temporary, "u6-transactions.vault.json");
    const historyArchivePath = join(temporary, "u7-budget-history-backup.zip");
    const historyDatasetPath = join(temporary, "u7-budget-history-dataset.json");
    const historyVaultPath = join(temporary, "u7-budget-history.vault.json");
  const distPath = join(temporary, "dist");
  const performanceCount = process.env.MYEXPENSES_PERF_COUNT;
  if (performanceCount !== undefined && !["1000", "10000", "50000"].includes(performanceCount)) {
    throw new Error("Invalid synthetic performance fixture size");
  }
  let server: ReturnType<typeof createServer> | undefined;
  let closing = false;
  const cleanup = async () => {
    if (closing) return;
    closing = true;
    await new Promise<void>((done) => server?.close(() => done()) ?? done());
    await rm(temporary, { recursive: true, force: true });
  };
  process.once("SIGTERM", () => { void cleanup().finally(() => { process.exitCode = 0; }); });
  process.once("SIGINT", () => { void cleanup().finally(() => { process.exitCode = 0; }); });
  try {
    const baseExtraSql = [
      "INSERT INTO categories (_id, uuid, label, parent_id, type) VALUES (14, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'Food', 10, 1)",
      "INSERT INTO payee (_id, name, short_name, iban, bic, parent_id) VALUES (3, 'Child payee', NULL, NULL, NULL, NULL)",
      "INSERT INTO paymentmethods (_id, label, is_numbered, type, icon) VALUES (4, 'Neutral method', 0, -1, NULL)",
      "UPDATE transactions SET payee_id = 1, method_id = 1 WHERE _id = 1",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (15, '10000000-0000-4000-8000-000000000015', 'Synthetic food', 1787425493, 1787425493, -25, 14, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (16, '10000000-0000-4000-8000-000000000016', 'July coverage', 1782900000, 1782900000, -10, 10, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (17, '10000000-0000-4000-8000-000000000017', 'Synthetic refund', 1787425493, 1787425493, 20, 10, 1, NULL, 0, 'RECONCILED')",
      "UPDATE transactions SET payee_id = 1, method_id = 1 WHERE _id = 15",
      "UPDATE transactions SET payee_id = 3, method_id = 4 WHERE _id = 17",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (1, 10, 2026, 7, 100, 0, 0, 0)",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (1, 14, 2026, 7, 20, 0, 0, 0)",
    ];
    const database = await createImportDatabaseFixture({ extraSql: baseExtraSql });
    await writeFile(archivePath, await createBackupZipFixture({ database }), { mode: 0o600 });
    await importBackup({
      inputPath: archivePath,
      outputPath: datasetPath,
      timeZone: "Europe/Madrid",
      backupFilenameTimestamp: "20260822210453",
      importedAt: "2026-08-23T10:00:00.000Z",
    });
    let performanceMetadata: Record<string, number> | undefined;
    if (performanceCount !== undefined) {
      const seed = await createImportedHistorySeed(temporary);
      const source = makeSyntheticHistory(seed, Number(performanceCount));
      await writeFile(datasetPath, JSON.stringify(source), { mode: 0o600 });
      const analytics = normalizeDataset(source);
      const filters = { ...createDefaultFilterState(), scope: "realCashFlow" as const };
      performanceMetadata = {
        postings: analytics.postings.length,
        real: applyFilters(analytics, filters).activePostings.length,
        search: applyFilters(analytics, { ...filters, search: "perf-marker" }).activePostings.length,
        debts: applyFilters(analytics, { ...filters, scope: "debtsOnly" }).activePostings.length,
        date: applyFilters(analytics, { ...filters, periodMode: "custom", dateRange: { from: "2026-07-01", to: "2026-08-31" } }).activePostings.length,
      };
    }
    const legacy = JSON.parse(await readFile(datasetPath, "utf8")) as { source: Record<string, unknown> };
    delete legacy.source.backupFilenameTimestamp;
    delete legacy.source.importedAt;
    await writeFile(legacyDatasetPath, JSON.stringify(legacy), { mode: 0o600 });
    await encryptDataset({ inputPath: datasetPath, outputPath: vaultPath, passphrase: PASSPHRASE });
    await encryptDataset({ inputPath: legacyDatasetPath, outputPath: legacyVaultPath, passphrase: PASSPHRASE });
    await rm(archivePath);
    await rm(datasetPath);
    await rm(legacyDatasetPath);
    process.env.MYEXPENSES_APP_REVISION = REVISION;
    const built = await runBuildStaticCli(["--vault", vaultPath, "--out-dir", distPath], { prompt: async () => PASSPHRASE });
    if (built !== 0) throw new Error("Synthetic browser build failed");
    if (performanceMetadata !== undefined) {
      await writeFile(join(distPath, "data", "performance-meta.json"), JSON.stringify(performanceMetadata));
    }
    await copyFile(legacyVaultPath, join(distPath, "data", "legacy.vault.json"));
    const noLimitDatabase = await createImportDatabaseFixture({ extraSql: [
      ...baseExtraSql,
      "DELETE FROM budget_allocations WHERE budget_id = 1 AND cat_id = 0",
      ...Array.from({ length: 23 }, (_, index) => {
        const id = index + 20;
        const uuid = `10000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
        return `INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (${id}, '${uuid}', 'Additional synthetic expense ${id}', 1787425493, 1787425493, -1, 10, 1, NULL, 0, 'RECONCILED')`;
      }),
    ] });
    await writeFile(noLimitArchivePath, await createBackupZipFixture({ database: noLimitDatabase }), { mode: 0o600 });
    await importBackup({
      inputPath: noLimitArchivePath,
      outputPath: noLimitDatasetPath,
      timeZone: "Europe/Madrid",
      backupFilenameTimestamp: "20260822210453",
      importedAt: "2026-08-23T10:00:00.000Z",
    });
    await encryptDataset({ inputPath: noLimitDatasetPath, outputPath: noLimitVaultPath, passphrase: PASSPHRASE });
    await copyFile(noLimitVaultPath, join(distPath, "data", "u3-budget.vault.json"));
    const transactionDatabase = await createImportDatabaseFixture({ extraSql: [
      ...baseExtraSql,
      "INSERT INTO payee (_id, name, short_name, iban, bic, parent_id) VALUES (5, 'Synthetic payee with an identifying suffix that extends beyond the compact row 123456789', NULL, NULL, NULL, NULL)",
      "INSERT INTO payee (_id, name, short_name, iban, bic, parent_id) VALUES (6, 'Synthetic categorized transfer payee with a long identifying suffix 123456789', NULL, NULL, NULL, NULL)",
      "UPDATE transactions SET payee_id = 5, comment = 'Synthetic food comment with complete context that extends beyond the compact row 987654321', cr_status = 'UNRECONCILED' WHERE _id = 15",
      "UPDATE transactions SET cat_id = 10, payee_id = 6, comment = 'Synthetic categorized transfer comment with exceptionally long context AndAnUnbrokenIdentifier12345678901234567890' WHERE _id = 4",
      "UPDATE transactions SET cat_id = 10 WHERE _id = 5",
    ] });
    await writeFile(transactionArchivePath, await createBackupZipFixture({ database: transactionDatabase }), { mode: 0o600 });
    await importBackup({
      inputPath: transactionArchivePath,
      outputPath: transactionDatasetPath,
      timeZone: "Europe/Madrid",
      backupFilenameTimestamp: "20260822210453",
      importedAt: "2026-08-23T10:00:00.000Z",
    });
    await encryptDataset({ inputPath: transactionDatasetPath, outputPath: transactionVaultPath, passphrase: PASSPHRASE });
    await copyFile(transactionVaultPath, join(distPath, "data", "u6-transactions.vault.json"));
    // Dedicated covered May–August history; existing browser fixture oracles stay unchanged.
    const historyDatabase = await createImportDatabaseFixture({ extraSql: [
      ...baseExtraSql,
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (100, '10000000-0000-4000-8000-000000000100', 'History coverage start', 1777636800, 1777636800, 0, 13, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (101, '10000000-0000-4000-8000-000000000101', 'May food', 1778414400, 1778414400, -1000, 14, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (102, '10000000-0000-4000-8000-000000000102', 'May income', 1778414400, 1778414400, 100000, 11, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (103, '10000000-0000-4000-8000-000000000103', 'July food A', 1783684800, 1783684800, -2000, 14, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (104, '10000000-0000-4000-8000-000000000104', 'July food B', 1784548800, 1784548800, -3000, 14, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (105, '10000000-0000-4000-8000-000000000105', 'July income A', 1783684800, 1783684800, 80000, 11, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (106, '10000000-0000-4000-8000-000000000106', 'July income B', 1784980800, 1784980800, 120000, 11, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO transactions (_id, uuid, comment, date, value_date, amount, cat_id, account_id, parent_id, status, cr_status) VALUES (107, '10000000-0000-4000-8000-000000000107', 'History coverage end', 1788177600, 1788177600, 0, 13, 1, NULL, 0, 'RECONCILED')",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (1, 10, 2026, 6, 100, 0, 0, 0)",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (1, 14, 2026, 6, 20, 0, 0, 0)",
      "INSERT INTO budgets (_id, uuid, title, description, grouping, account_id, currency, start, end, is_default) VALUES (2, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Alternate monthly', '', 'MONTH', 1, '___', NULL, NULL, 0)",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (2, 0, 2026, 7, 500, 0, 0, 0)",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (2, 10, 2026, 7, 100, 0, 0, 0)",
      "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (2, 14, 2026, 7, 20, 0, 0, 0)",
    ] });
    await writeFile(historyArchivePath, await createBackupZipFixture({ database: historyDatabase }), { mode: 0o600 });
    await importBackup({
      inputPath: historyArchivePath, outputPath: historyDatasetPath, timeZone: "Europe/Madrid",
      backupFilenameTimestamp: "20260822210453", importedAt: "2026-08-23T10:00:00.000Z",
    });
    await encryptDataset({ inputPath: historyDatasetPath, outputPath: historyVaultPath, passphrase: PASSPHRASE });
    await copyFile(historyVaultPath, join(distPath, "data", "u7-budget-history.vault.json"));
    await rm(historyArchivePath);
    await rm(historyDatasetPath);
    await rm(historyVaultPath);
    await rm(transactionArchivePath);
    await rm(transactionDatasetPath);
    await rm(transactionVaultPath);
    await rm(noLimitArchivePath);
    await rm(noLimitDatasetPath);
    await rm(noLimitVaultPath);
    await rm(vaultPath);
    await rm(legacyVaultPath);
    const distReal = await realpath(distPath);
    server = createServer(async (request, response) => {
      try {
        if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
        if (/(?:\.\.|%2e)/iu.test(request.url ?? "")) { response.writeHead(400).end(); return; }
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (!pathname.startsWith("/assets/") &&
            pathname !== "/data/app-dataset.vault.json" && pathname !== "/data/legacy.vault.json" && pathname !== "/data/u3-budget.vault.json" && pathname !== "/data/u6-transactions.vault.json" && pathname !== "/data/u7-budget-history.vault.json" && !(performanceMetadata !== undefined && pathname === "/data/performance-meta.json") &&
            pathname !== "/index.html" && !APP_ROUTES.has(pathname)) {
          response.writeHead(404).end(); return;
        }
        const file = pathname.startsWith("/assets/") || pathname === "/data/app-dataset.vault.json" || pathname === "/data/legacy.vault.json" || pathname === "/data/u3-budget.vault.json" || pathname === "/data/u6-transactions.vault.json" || (performanceMetadata !== undefined && pathname === "/data/performance-meta.json") || pathname === "/data/u7-budget-history.vault.json"
          ? join(distReal, decodeURIComponent(pathname))
          : join(distReal, "index.html");
        const fileReal = await realpath(file);
        if (!within(distReal, fileReal) || (await lstat(file)).isSymbolicLink()) {
          response.writeHead(403).end(); return;
        }
        const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" }[extname(fileReal)] ?? "application/octet-stream";
        response.writeHead(200, { "Content-Type": `${mime}; charset=utf-8`, "Cache-Control": "no-store" });
        if (request.method === "GET") response.end(await readFile(fileReal)); else response.end();
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((done, reject) => {
      server!.once("error", reject);
      server!.listen(PORT, "127.0.0.1", done);
    });
    process.stdout.write(`Synthetic browser fixture ready at http://127.0.0.1:${PORT}\n`);
  } catch (error) {
    await cleanup();
    throw error;
  }
}

await main();
