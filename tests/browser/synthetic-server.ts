import { createServer } from "node:http";
import { chmod, copyFile, lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { createBackupZipFixture, createImportDatabaseFixture } from "../../scripts/import-backup/test-fixtures.ts";
import { importBackup } from "../../scripts/import-backup/import-backup.ts";
import { encryptDataset } from "../../scripts/encrypt-dataset/encrypt-dataset.ts";
import { runBuildStaticCli } from "../../scripts/build-static/cli.ts";

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
  const distPath = join(temporary, "dist");
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
    const database = await createImportDatabaseFixture({ extraSql: [
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
    ] });
    await writeFile(archivePath, await createBackupZipFixture({ database }), { mode: 0o600 });
    await importBackup({
      inputPath: archivePath,
      outputPath: datasetPath,
      timeZone: "Europe/Madrid",
      backupFilenameTimestamp: "20260822210453",
      importedAt: "2026-08-23T10:00:00.000Z",
    });
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
    await copyFile(legacyVaultPath, join(distPath, "data", "legacy.vault.json"));
    await rm(vaultPath);
    await rm(legacyVaultPath);
    const distReal = await realpath(distPath);
    server = createServer(async (request, response) => {
      try {
        if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
        if (/(?:\.\.|%2e)/iu.test(request.url ?? "")) { response.writeHead(400).end(); return; }
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (!pathname.startsWith("/assets/") &&
            pathname !== "/data/app-dataset.vault.json" && pathname !== "/data/legacy.vault.json" &&
            pathname !== "/index.html" && !APP_ROUTES.has(pathname)) {
          response.writeHead(404).end(); return;
        }
        const file = pathname.startsWith("/assets/") || pathname === "/data/app-dataset.vault.json" || pathname === "/data/legacy.vault.json"
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
