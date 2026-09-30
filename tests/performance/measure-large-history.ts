import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { arch, cpus, platform, tmpdir, totalmem } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";

import { analyzeBudgetPeriodComparison } from "../../src/domain/analytics/budget-period-comparison.ts";
import { analyzeBudgetPeriod } from "../../src/domain/analytics/budgets.ts";
import { applyFilters, createDefaultFilterState } from "../../src/domain/analytics/filters.ts";
import { normalizeDataset } from "../../src/domain/analytics/normalize.ts";
import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { createCategoriesPageModel } from "../../src/presentation/pages/CategoriesPage/CategoriesPage.helpers.ts";
import { createImportedHistorySeed, makeSyntheticHistory } from "./synthetic-history.ts";
import { summarizeSamples } from "./summary.ts";

function argument(name: string, fallback?: string): string {
  const value = process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (value === undefined && fallback === undefined) throw new Error(`Missing --${name}=...`);
  return value ?? fallback!;
}

function positiveInteger(value: string, name: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  return number;
}

const counts = argument("counts", "1000,10000,50000").split(",").map((value) => positiveInteger(value, "count"));
const warmups = positiveInteger(argument("warmups", "1"), "warmups");
const repeats = positiveInteger(argument("repeats", "3"), "repeats");
const output = argument("output");
const outputRelativeToRepository = relative(process.cwd(), output);
if (!isAbsolute(output) ||
    (outputRelativeToRepository !== ".." &&
      !outputRelativeToRepository.startsWith(`..${sep}`) &&
      !isAbsolute(outputRelativeToRepository))) {
  throw new Error("Output must be an absolute path outside the repository");
}

const directory = await mkdtemp(join(tmpdir(), "myexpenses-perf-seed-"));
try {
  const seed = await createImportedHistorySeed(directory);
  const rows = [];
  for (const count of counts) {
    const source = makeSyntheticHistory(seed, count);
    const serialized = JSON.stringify(source);
    const parsed = parseBackupDataset(JSON.parse(serialized));
    const analytics = normalizeDataset(parsed);
    const filters = { ...createDefaultFilterState(), scope: "realCashFlow" as const };
    const filtered = applyFilters(analytics, filters);
    const budget = analytics.backup?.budgets[0];
    if (!budget) throw new Error("Imported fixture has no budget");
    const budgetResult = analyzeBudgetPeriod(analytics, filtered, budget, "MONTH:2026:7");
    if (budgetResult.status !== "ready") throw new Error(budgetResult.reason);
    const analysis = budgetResult.analysis;
    if (analysis.period.startDate !== "2026-08-01" || analysis.contributions.length === 0) {
      throw new Error("Synthetic August budget period was not selected or contains no consumption");
    }
    const comparison = analyzeBudgetPeriodComparison(analytics, analysis, filters, { today: "2026-10-01" });
    if (comparison.status !== "ready") throw new Error(comparison.reason);
    const categoryResult = createCategoriesPageModel(analytics, filtered, [], "month", () => undefined, () => undefined,
      undefined, undefined, undefined, undefined, undefined, "2026-10-01");
    const operations: Record<string, () => number> = {
      "validate+normalize": () => normalizeDataset(parseBackupDataset(JSON.parse(serialized))).postings.length,
      normalize: () => normalizeDataset(parsed).postings.length,
      "filter-search": () => applyFilters(analytics, { ...filters, search: "perf-marker" }).postings.length,
      "filter-category": () => applyFilters(analytics, { ...filters, categoryPrefixes: [["Expense", "Food"]] }).postings.length,
      "filter-date": () => applyFilters(analytics, { ...filters, periodMode: "custom", dateRange: { from: "2026-07-01", to: "2026-08-31" } }).postings.length,
      "filter-perspective": () => applyFilters(analytics, { ...filters, scope: "debtsOnly" }).postings.length,
      "categories-model": () => createCategoriesPageModel(analytics, filtered, [], "month", () => undefined, () => undefined,
        undefined, undefined, undefined, undefined, undefined, "2026-10-01").categoryCount,
      "budget-current": () => {
        const result = analyzeBudgetPeriod(analytics, filtered, budget, "MONTH:2026:7");
        if (result.status !== "ready") throw new Error(result.reason);
        return result.analysis.global.consumedMinor;
      },
      "budget-comparison": () => {
        const result = analyzeBudgetPeriodComparison(analytics, analysis, filters, { today: "2026-10-01" });
        if (result.status !== "ready") throw new Error(result.reason);
        return result.comparison.mean.consumedTotalMinor ?? 0;
      },
    };
    const timings: Record<string, { medianMs: number; minMs: number; maxMs: number; samplesMs: number[]; checksum: number }> = {};
    for (const [name, operation] of Object.entries(operations)) {
      for (let index = 0; index < warmups; index++) operation();
      const samplesMs: number[] = [];
      let checksum = 0;
      for (let index = 0; index < repeats; index++) {
        const start = performance.now();
        checksum += operation();
        samplesMs.push(performance.now() - start);
      }
      timings[name] = { ...summarizeSamples(samplesMs), samplesMs, checksum };
    }
    rows.push({
      requestedPostings: count,
      actualPostings: analytics.postings.length,
      serializedBytes: Buffer.byteLength(serialized),
      observed: {
        filteredPostings: filtered.postings.length,
        categoryCount: categoryResult.categoryCount,
        categoryActivityEurMinor: categoryResult.activityEurMinor,
        budgetConsumedMinor: analysis.global.consumedMinor,
        previousConsumedMinor: comparison.comparison.references[0]?.consumedMinor ?? null,
        meanConsumedMinor: comparison.comparison.mean.consumedTotalMinor,
      },
      timings,
    });
  }
  const result = {
    fixture: "imported schema-189 seed plus deterministic synthetic postings v1",
    metadata: {
      node: process.version, platform: platform(), architecture: arch(),
      cpu: cpus()[0]?.model ?? "unknown", logicalCpus: cpus().length,
      totalMemoryBytes: totalmem(), timeZone: process.env.TZ ?? "unspecified",
      warmups, repeats, generatedAt: new Date().toISOString(),
    },
    rows,
  };
  await writeFile(output, JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
