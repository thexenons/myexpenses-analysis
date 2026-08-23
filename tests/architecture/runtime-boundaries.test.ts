import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the production unlock graph does not import the legacy export normalizer", async () => {
  const [unlockSource, filterSource] = await Promise.all([
    readFile(
      new URL(
        "../../src/application/use-cases/unlock-analytics.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../src/domain/analytics/filters.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(unlockSource, /normalize-backup-dataset\.ts/u);
  assert.doesNotMatch(unlockSource, /from\s+["'].*\/normalize\.ts["']/u);
  assert.doesNotMatch(filterSource, /from\s+["']\.\/normalize\.ts["']/u);
});
