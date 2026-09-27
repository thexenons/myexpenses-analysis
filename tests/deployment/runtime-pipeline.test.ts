import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const repository = join(dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (value: Uint8Array | string, algorithm = "sha256") =>
    createHash(algorithm).update(value).digest("hex");
const exists = async (path: string) => lstat(path).then(() => true, () => false);

async function files(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    const output: string[] = [];
    for (const entry of entries) {
        const child = join(path, entry.name);
        assert.equal(entry.isSymbolicLink(), false);
        if (entry.isDirectory()) {
            // oxlint-disable-next-line no-await-in-loop -- inspect one immutable release tree.
            output.push(...await files(child));
        } else output.push(child);
    }
    return output;
}

test("synthetic pCloud backup publishes validated static releases and preserves the last good release", {
    timeout: 240_000,
}, async () => {
    const root = await mkdtemp(join(tmpdir(), "myexpenses-deployment-test-"));
    await chmod(root, 0o700);
    const project = join(root, "project");
    const deploy = join(root, "deploy");
    const token = "SYNTHETIC-ONLY-PCLOUD-TOKEN-77Q2";
    const passphrase = "SYNTHETIC-ONLY-VAULT-PASSPHRASE-89K4";
    const canary = "SYNTHETIC-VITE-LEAK-CANARY-65F3";
    const forbidden = [token, passphrase, canary, "PRIVATE-IBAN", "PRIVATE-BIC"];
    const originalFetch = globalThis.fetch;
    const originalSpawn = childProcess.spawn;
    const originalToken = process.env.PCLOUD_TOKEN;
    const originalPassphrase = process.env.MYEXPENSES_VAULT_PASSPHRASE;
    const originalCanary = process.env.VITE_SYNTHETIC_CANARY;
    const originalSourceCommit = process.env.SOURCE_COMMIT;
    const originalAppRevision = process.env.MYEXPENSES_APP_REVISION;
    const revision = "c".repeat(40);
    const buildKinds: string[] = [];
    const logs: string[] = [];
    const visibilityErrors: string[] = [];
    let buildOutput = "";
    let unexpectedNetworkCalls = 0;
    let downloads = 0;
    let pipelineCalls = 0;
    let visibilitySamples = 0;
    let stopMonitor = false;
    let monitor: Promise<void> | undefined;
    try {
        await mkdir(project, { mode: 0o700 });
        await mkdir(deploy, { mode: 0o700 });
        const dockerfile = await readFile(join(repository, "Dockerfile"), "utf8");
        const inputs = dockerfile.split("\n")
            .filter((line) => line.startsWith("COPY ") && !line.includes("deploy/nginx.coolify.conf"))
            .flatMap((line) => line.split(/\s+/u).slice(1, -1));
        assert.ok(inputs.includes("scripts/"));
        for (const input of inputs) {
            // oxlint-disable-next-line no-await-in-loop -- stage each Dockerfile COPY source in order.
            await cp(join(repository, input), join(project, input), {
                recursive: true,
                filter: async (source) => {
                    assert.equal((await lstat(source)).isSymbolicLink(), false);
                    assert.doesNotMatch(source, /(?:^|\/)\.env|\.(?:zip|db|sql|token|passphrase|vault\.json)$/u);
                    return true;
                },
            });
        }
        await mkdir(join(project, "node_modules"), { mode: 0o700 });
        // Reuse local dependencies; this test does not prove container installation.
        for (const entry of await readdir(join(repository, "node_modules"))) {
            if ([".tmp", ".vite", ".vite-temp"].includes(entry)) continue;
            // oxlint-disable-next-line no-await-in-loop -- keep the sandbox's package tree independent of build caches.
            await symlink(join(repository, "node_modules", entry), join(project, "node_modules", entry));
        }
        await mkdir(join(project, "node_modules", ".tmp"), { mode: 0o700 });
        await mkdir(join(project, "node_modules", ".vite-temp"), { mode: 0o700 });

        const load = (path: string) => import(pathToFileURL(join(project, path)).href);
        const { createImportDatabaseFixture, createBackupZipFixture } = await load("scripts/import-backup/test-fixtures.ts");
        const { importBackup } = await load("scripts/import-backup/import-backup.ts");
        const { parseStaticVaultEnvelopeJson, decryptCompressedDataset } = await load("src/domain/security/static-vault.ts");
        const { parseBackupDataset, normalizeBackupDataset } = await load("src/domain/analytics/normalize-backup-dataset.ts");
        const { applyFilters, createDefaultFilterState } = await load("src/domain/analytics/filters.ts");
        const { aggregateDebtBreakdown, aggregateKpis } = await load("src/domain/analytics/aggregations.ts");
        const dbA: Uint8Array = await createImportDatabaseFixture();
        const dbB: Uint8Array = await createImportDatabaseFixture({
            extraSql: ["UPDATE transactions SET amount = -200 WHERE _id = 1"],
        });
        const zipA: Uint8Array = await createBackupZipFixture({ database: dbA });
        const zipB: Uint8Array = await createBackupZipFixture({ database: dbB });
        const expected: Buffer[] = [];
        for (const [index, archive] of [zipA, zipB].entries()) {
            const inputPath = join(root, `oracle-${index}.zip`);
            const outputPath = join(root, `oracle-${index}.json`);
            // oxlint-disable-next-line no-await-in-loop -- derive each independent import oracle.
            await writeFile(inputPath, archive, { mode: 0o600 });
            // oxlint-disable-next-line no-await-in-loop -- import before its temporary source is removed.
            await importBackup({ inputPath, outputPath, timeZone: "Europe/Madrid" });
            // oxlint-disable-next-line no-await-in-loop -- retain only synthetic fixture bytes in memory.
            expected.push(await readFile(outputPath));
            // oxlint-disable-next-line no-await-in-loop -- clean each oracle before the next.
            await rm(inputPath);
            // oxlint-disable-next-line no-await-in-loop -- clean each oracle before the next.
            await rm(outputPath);
        }

        globalThis.fetch = async () => {
            unexpectedNetworkCalls += 1;
            throw new Error("Real network is forbidden in the synthetic deployment test");
        };
        process.env.PCLOUD_TOKEN = token;
        process.env.MYEXPENSES_VAULT_PASSPHRASE = passphrase;
        process.env.VITE_SYNTHETIC_CANARY = canary;
        process.env.SOURCE_COMMIT = revision;
        process.env.MYEXPENSES_APP_REVISION = "";
        Object.defineProperty(childProcess, "spawn", { configurable: true, writable: true, value: ((...args: Parameters<typeof originalSpawn>) => {
            const options = args[2];
            const script = args[1]?.[0];
            const isBuild = typeof script === "string" && /\/(?:typescript\/bin\/tsc|vite\/bin\/vite\.js)$/u.test(script);
            if (isBuild) {
                assert.ok(options?.env, "build child must have an explicit filtered environment");
                for (const secret of [token, passphrase, canary]) {
                    assert.ok(!Object.values(options.env).some((value) => String(value).includes(secret)));
                }
                assert.equal(options.env.MYEXPENSES_APP_REVISION, revision);
                assert.equal(options.env.SOURCE_COMMIT, undefined);
                buildKinds.push(script.endsWith("/tsc") ? "tsc" : "vite");
            }
            const child = originalSpawn(...args);
            if (isBuild) {
                for (const stream of [child.stdout, child.stderr]) {
                    stream?.on("data", (chunk: Buffer) => { buildOutput += chunk.toString(); });
                }
            }
            return child;
        }) });
        syncBuiltinESMExports();

        const { PCloudClient } = await load("scripts/sync-pcloud/pcloud.ts");
        const { runPCloudSync } = await load("scripts/sync-pcloud/orchestrator.ts");
        const { processBackupForStaticRelease } = await load("scripts/sync-pcloud/process-backup.ts");
        const { loadSyncPCloudRuntimeConfig } = await load("scripts/sync-pcloud/runtime-config.ts");
        let remote = { id: 100, archive: zipA };
        const metadata = () => ({
            id: `f${remote.id}`, fileid: remote.id, isfolder: false,
            modified: 1_787_425_493 + remote.id,
            name: "myexpenses-backup-20260822-210453.zip", size: remote.archive.length,
        });
        const json = (body: object) => new Response(JSON.stringify({ result: 0, ...body }));
        const api = async (input: string | URL, init?: RequestInit) => {
            const url = new URL(String(input));
            if (url.hostname === "eapi.pcloud.com") {
                assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);
                if (url.pathname === "/listfolder") return json({ metadata: { isfolder: true, contents: [metadata()] } });
                if (url.pathname === "/checksumfile") return json({ metadata: metadata(), sha1: hash(remote.archive, "sha1"), sha256: hash(remote.archive) });
                if (url.pathname === "/getfilelink") return json({ hosts: ["synthetic.pcloud.com"], path: "/fixture.zip", expires: "2035-01-01T00:00:00Z" });
            }
            if (url.hostname === "synthetic.pcloud.com" && url.pathname === "/fixture.zip") {
                assert.equal(init?.headers, undefined, "token must not cross content download boundary");
                downloads += 1;
                return new Response(remote.archive, { headers: { "Content-Length": String(remote.archive.length) } });
            }
            throw new Error("Unexpected synthetic pCloud API request");
        };
        const runtime = loadSyncPCloudRuntimeConfig({
            PCLOUD_API_HOST: "eapi.pcloud.com", PCLOUD_FOLDER_ID: "10", PCLOUD_TOKEN: token,
            MYEXPENSES_VAULT_PASSPHRASE: passphrase, MYEXPENSES_DEPLOY_ROOT: deploy,
            MYEXPENSES_REPOSITORY_ROOT: project, MYEXPENSES_TIME_ZONE: "Europe/Madrid",
        });
        const dependencies = {
            createClient: (options: object) => new PCloudClient({ ...options, fetch: api }),
            loadSecrets: async () => runtime.secrets,
            logger: { info: (message: string) => logs.push(message) },
            processBackup: async (input: { workspacePath: string }, signal: AbortSignal) => {
                pipelineCalls += 1;
                assert.equal((await stat(input.workspacePath)).mode & 0o777, 0o700);
                assert.equal((await stat(input.workspacePath)).dev, (await stat(join(deploy, "releases"))).dev);
                const result = await processBackupForStaticRelease(input, signal);
                assert.equal(await exists(join(input.workspacePath, "app-dataset.json")), false);
                return result;
            },
        };
        const snapshot = async () => ({
            link: await readlink(join(deploy, "current")),
            state: await readFile(join(deploy, ".sync-state.json"), "utf8"),
        });
        let publishedOnce = false;
        monitor = (async () => {
            // oxlint-disable-next-line no-unmodified-loop-condition -- the test stops polling after the final publication.
            while (!stopMonitor) {
                try {
                    // oxlint-disable-next-line no-await-in-loop -- sample the visible symlink during publication.
                    const target = await readlink(join(deploy, "current"));
                    publishedOnce = true;
                    const release = join(deploy, target);
                    // oxlint-disable-next-line no-await-in-loop -- verify each sampled release is complete.
                    assert.match(await readFile(join(release, "index.html"), "utf8"), /type="module"/u);
                    // oxlint-disable-next-line no-await-in-loop -- verify vault visibility with the HTML sample.
                    parseStaticVaultEnvelopeJson(await readFile(join(release, "data/app-dataset.vault.json"), "utf8"));
                    visibilitySamples += 1;
                } catch (error) {
                    if (publishedOnce || !error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
                        visibilityErrors.push("A visible release was missing or incomplete");
                    }
                }
                // oxlint-disable-next-line no-await-in-loop -- polling ends in finally.
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
        })();

        async function checkPublished(expectedIndex: number): Promise<string> {
            const target = await readlink(join(deploy, "current"));
            const release = join(deploy, target);
            assert.deepEqual(await readdir(join(release, "data")), ["app-dataset.vault.json"]);
            const envelope = parseStaticVaultEnvelopeJson(await readFile(join(release, "data/app-dataset.vault.json"), "utf8"));
            const compressed: Uint8Array = await decryptCompressedDataset(envelope, passphrase, globalThis.crypto);
            const plain = gunzipSync(compressed);
            compressed.fill(0);
            const dataset = parseBackupDataset(JSON.parse(plain.toString()));
            plain.fill(0);
            const { backupFilenameTimestamp, importedAt, ...legacySource } = dataset.source;
            assert.deepEqual({ ...dataset, source: legacySource }, JSON.parse(expected[expectedIndex]!.toString()));
            assert.equal(backupFilenameTimestamp, "20260822210453");
            assert.match(importedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
            assert.equal(dataset.accounts.length, 4);
            assert.equal(dataset.postings.length, 11);
            assert.equal(dataset.source.backupSha256, hash(remote.archive));
            assert.equal(dataset.source.databaseSha256, hash(expectedIndex === 0 ? dbA : dbB));
            const debt = dataset.accounts.find((account: { sourceId: number }) => account.sourceId === 2);
            assert.equal(debt.scope, "DEBT");
            assert.equal(debt.balances.currentNativeMinor, 250);
            const transfer = dataset.postings.find((posting: { sourceId: number }) => posting.sourceId === 4);
            const peer = dataset.postings.find((posting: { sourceId: number }) => posting.sourceId === 5);
            assert.equal(transfer.transferPeer.postingId, peer.id);
            assert.equal(peer.transferPeer.postingId, transfer.id);
            assert.equal(dataset.postings.find((posting: { sourceId: number }) => posting.sourceId === 3).isVoid, true);
            const normalized = normalizeBackupDataset(dataset);
            const all = applyFilters(normalized, createDefaultFilterState());
            const debtOnly = applyFilters(normalized, { ...createDefaultFilterState(), scope: "debtsOnly" });
            const cashOnly = applyFilters(normalized, { ...createDefaultFilterState(), scope: "realCashFlow" });
            assert.equal(debtOnly.accounts.length, 1);
            assert.equal(cashOnly.accounts.length, 3);
            assert.equal(aggregateDebtBreakdown(debtOnly)[0].account.currentBalanceNativeMinor, 250);
            assert.equal(aggregateKpis(all).periodClosingBalanceEurMinor,
                aggregateKpis(debtOnly).periodClosingBalanceEurMinor + aggregateKpis(cashOnly).periodClosingBalanceEurMinor);
            let revisionPublished = false;
            for (const file of await files(release)) {
                assert.doesNotMatch(file, /(?:app-dataset\.json|BACKUP(?:_PREF)?|\.zip|\.sqlite|\.db)$/u);
                // oxlint-disable-next-line no-await-in-loop -- scan every published asset for fixture canaries.
                const bytes = await readFile(file);
                if (file.endsWith(".js") && bytes.includes(Buffer.from(revision))) revisionPublished = true;
                for (const secret of forbidden) assert.equal(bytes.includes(Buffer.from(secret)), false);
            }
            assert.equal(revisionPublished, true);
            assert.deepEqual(await readdir(join(deploy, ".work")), []);
            const state = JSON.parse(await readFile(join(deploy, ".sync-state.json"), "utf8"));
            assert.equal(state.localSha256, hash(remote.archive));
            assert.equal(state.fileId, String(remote.id));
            assert.equal(state.releaseId, basename(target));
            await assert.rejects(() => decryptCompressedDataset(envelope, "wrong-but-long-enough-passphrase", globalThis.crypto));
            return target;
        }

        assert.equal((await runPCloudSync(runtime.config, dependencies, { force: true, signal: AbortSignal.timeout(120_000) })).status, "published");
        const first = await checkPublished(0);
        const beforeNoop = await snapshot();
        assert.equal((await runPCloudSync(runtime.config, dependencies, { signal: AbortSignal.timeout(120_000) })).status, "noop");
        assert.equal(pipelineCalls, 1);
        assert.equal(downloads, 1);
        assert.deepEqual(await snapshot(), beforeNoop);
        const html = await readFile(join(project, "index.html"), "utf8");
        await writeFile(join(project, "index.html"), html.replace("</title>", " synthetic-revision-two</title>"));
        assert.equal((await runPCloudSync(runtime.config, dependencies, { force: true, signal: AbortSignal.timeout(120_000) })).status, "published");
        const forced = await checkPublished(0);
        assert.notEqual(forced, first);
        assert.match(await readFile(join(deploy, forced, "index.html"), "utf8"), /synthetic-revision-two/u);
        remote = { id: 101, archive: zipB };
        assert.equal((await runPCloudSync(runtime.config, dependencies, { signal: AbortSignal.timeout(120_000) })).status, "published");
        assert.notEqual(await checkPublished(1), forced);
        const good = await snapshot();
        const releases = await readdir(join(deploy, "releases"));
        remote = { id: 102, archive: zipB };
        await writeFile(join(project, "src/main.tsx"), "\nSYNTHETIC_TYPESCRIPT_SYNTAX_FAILURE )\n", { flag: "a" });
        await assert.rejects(() => runPCloudSync(runtime.config, dependencies, { signal: AbortSignal.timeout(120_000) }), /Production build failed/u);
        assert.deepEqual(await snapshot(), good);
        assert.deepEqual(await readdir(join(deploy, "releases")), releases);
        assert.deepEqual(await readdir(join(deploy, ".work")), []);
        assert.equal(pipelineCalls, 4);
        assert.equal(downloads, 4);
        assert.equal(buildKinds.filter((kind) => kind === "tsc").length, 4);
        assert.equal(buildKinds.filter((kind) => kind === "vite").length, 3);
        stopMonitor = true;
        await monitor;
        assert.ok(visibilitySamples > 0);
        assert.deepEqual(visibilityErrors, []);
        for (const output of [logs.join("\n"), buildOutput]) {
            for (const secret of forbidden) assert.equal(output.includes(secret), false);
        }
        assert.equal(unexpectedNetworkCalls, 0);
    } finally {
        stopMonitor = true;
        await monitor;
        Object.defineProperty(childProcess, "spawn", { configurable: true, writable: true, value: originalSpawn });
        syncBuiltinESMExports();
        globalThis.fetch = originalFetch;
        for (const [key, value] of [
            ["PCLOUD_TOKEN", originalToken],
            ["MYEXPENSES_VAULT_PASSPHRASE", originalPassphrase],
            ["VITE_SYNTHETIC_CANARY", originalCanary],
            ["SOURCE_COMMIT", originalSourceCommit],
            ["MYEXPENSES_APP_REVISION", originalAppRevision],
        ] as const) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await rm(root, { force: true, recursive: true });
    }
});
