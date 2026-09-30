import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import { createImportedHistorySeed, makeSyntheticHistory } from "./synthetic-history.ts";
import { summarizeSamples } from "./summary.ts";

test("sample summaries retain median and full observed range without timing thresholds", () => {
  assert.deepEqual(summarizeSamples([5, 1, 4, 2]), { medianMs: 3, minMs: 1, maxMs: 5 });
  assert.throws(() => summarizeSamples([]), /sample/u);
});

test("synthetic histories are deterministic, exact-sized and valid at the importer boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "myexpenses-perf-fixture-"));
  try {
    const seed = await createImportedHistorySeed(directory);
    const first = makeSyntheticHistory(seed, 20);
    const second = makeSyntheticHistory(seed, 20);
    assert.deepEqual(first, second);
    assert.equal(first.postings.length, 20);
    assert.equal(new Set(first.postings.map((row) => row.id)).size, 20);
    assert.deepEqual(new Set(first.postings.map((row) => row.bucket)), new Set(["expense", "income", "transfer"]));
    assert.equal(first.postings.filter((row) => row.isVoid).length, 2);
    assert.ok(new Set(first.postings.map((row) => row.localDate)).size > 1);
    const validated = parseBackupDataset(first);
    assert.equal(normalizeDataset(validated).postings.length, 20);
    assert.throws(() => makeSyntheticHistory(seed, 19), /multiple of 10/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
