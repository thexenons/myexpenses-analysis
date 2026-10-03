import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const load = () => import("./measure-import-memory.ts");

test("defaults are bounded synthetic counts with one warmup and three fresh samples", async () => {
  const { parseArguments } = await load();
  const options = parseArguments([]);
  assert.deepEqual(options.counts, [1_000, 10_000, 50_000]);
  assert.equal(options.warmups, 1);
  assert.equal(options.repeats, 3);
  for (const args of [["--input=/private.zip"], ["--counts=0"], ["--counts=50001"],
    ["--counts=1,1"], ["--repeats=0"], ["--repeats=6"], ["--warmups=3"], ["--repeats=1.5"], ["--repeats=1", "--repeats=2"]]) {
    assert.throws(() => parseArguments(args));
  }
});

test("output rejects relative, repository and symlinked repository parents", async () => {
  const { validateOutput } = await load();
  await assert.rejects(validateOutput("relative.json"), /outside/);
  await assert.rejects(validateOutput(join(process.cwd(), "report.json")), /outside/);
  const directory = await mkdtemp(join(tmpdir(), "import-memory-test-"));
  try {
    await symlink(process.cwd(), join(directory, "repository"), "dir");
    await assert.rejects(validateOutput(join(directory, "repository", "report.json")), /outside/);
    await validateOutput(join(directory, "report.json"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("child admission rejects unsafe or mismatched counts, metrics and checksums", async () => {
  const { validateChildResult } = await load();
  const good = { role: "import", count: 2, postingCount: 2, accountCount: 4, categoryCount: 4,
    budgetCount: 1, amountHomeMinor: 100, checksum: "a".repeat(64), importMs: 1,
    peakRssBytes: 1024, outputBytes: 100, pid: 123 };
  assert.deepEqual(validateChildResult(good, "import", 2), good);
  for (const patch of [{ postingCount: 3 }, { count: 3 }, { amountHomeMinor: 0 },
    { peakRssBytes: -1 }, { importMs: Infinity }, { checksum: "invalid" }, { role: "fixture" }]) {
    assert.throws(() => validateChildResult({ ...good, ...patch }, "import", 2));
  }
});

test("existing output is never overwritten or measured", async () => {
  const { measure, parseArguments } = await load();
  const directory = await mkdtemp(join(tmpdir(), "import-memory-test-"));
  const output = join(directory, "keep.json");
  try {
    await writeFile(output, "user-owned");
    await assert.rejects(measure(parseArguments(["--counts=2", `--output=${output}`])), /EEXIST/);
    assert.equal(await readFile(output, "utf8"), "user-owned");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("failed children remove owned fixtures and incomplete report only", async () => {
  const { measure, parseArguments } = await load();
  const directory = await mkdtemp(join(tmpdir(), "import-memory-test-"));
  const output = join(directory, "failed.json");
  let work = "";
  try {
    await assert.rejects(measure(parseArguments(["--counts=2", `--output=${output}`]), async (request) => {
      work = request.directory;
      throw new Error("synthetic child failure");
    }), /synthetic child failure/);
    assert.ok(work);
    assert.equal(existsSync(work), false);
    assert.equal(existsSync(output), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("tiny synthetic ZIP uses fresh children, exact counts and repeatable financial checksum", async () => {
  const { measure, parseArguments } = await load();
  const directory = await mkdtemp(join(tmpdir(), "import-memory-test-"));
  const output = join(directory, "tiny.json");
  try {
    const report = await measure(parseArguments(["--counts=2", "--warmups=1", "--repeats=2", `--output=${output}`]));
    const run = report.runs[0]!;
    assert.equal(run.fixture.count, 2);
    assert.ok(run.fixture.databaseBytes > run.fixture.archiveBytes);
    assert.ok(run.fixture.expandedBytes >= run.fixture.databaseBytes);
    assert.equal(run.warmups.length, 1);
    assert.equal(run.samples.length, 2);
    assert.equal(new Set([...run.warmups, ...run.samples].map((sample) => sample.pid)).size, 3);
    for (const sample of [...run.warmups, ...run.samples]) {
      assert.equal(sample.postingCount, 2);
      assert.equal(sample.amountHomeMinor, 100);
      assert.ok(sample.peakRssBytes > 0);
      assert.ok(sample.roundTripMs >= sample.importMs);
      assert.equal(sample.checksum, run.samples[0]!.checksum);
    }
    assert.equal(report.cleanupComplete, true);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), report);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("large synthetic fixtures use bounded SQL batches instead of one overflowing WASM statement", async () => {
  const { fixtureStatements } = await load();
  const statements = fixtureStatements(50_000).slice(3);
  assert.equal(statements.length, 50);
  const counts = statements.map((statement) => (statement.match(/90000000-0000-4000-8000-/gu) ?? []).length);
  assert.ok(counts.every((count) => count > 0 && count <= 1_000));
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 50_000);
});

test("the opt-in child timeout is explicit and bounded without changing importer limits", async () => {
  const { parseArguments } = await load();
  assert.equal(parseArguments([]).timeoutMs, 600_000);
  assert.equal(parseArguments(["--timeout-ms=1000"]).timeoutMs, 1_000);
  for (const value of ["0", "600001", "1.5", "invalid"]) {
    assert.throws(() => parseArguments([`--timeout-ms=${value}`]));
  }
});
