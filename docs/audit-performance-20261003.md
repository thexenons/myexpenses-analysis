# Retain current caches and UI-test isolation

Synthetic measurements on 2026-10-03 did not justify a new split lookup cache,
changing history filters, or reducing UI-test workers. These observations are
not latency promises, production-device measurements, or pass/fail thresholds.

## Environment and method

- Node 24.19.0, Linux x64, Ryzen 5 3600, 12 logical CPUs.
- Existing synthetic history: 1k/10k/50k postings, one warmup, three measured
  samples. Real-flow posting counts: 700/7k/35k. Fixed four-category tree.
- Run the existing command in [the performance guide](../tests/performance/README.md),
  keeping its JSON output outside the repository. No private vault was accessed.
- Historical 466ms measured validation **and** normalization at 50k, not
  normalization alone. Current variation is not a demonstrated optimization gain.

## History measurements

Milliseconds: median (minimum–maximum).

| Operation | 1k postings | 10k postings | 50k postings |
| --- | --- | --- | --- |
| Validate + normalize | 10.57 (10.22–11.56) | 104.99 (87.96–107.19) | 393.09 (388.31–474.40) |
| Normalize only | 3.99 (3.61–4.43) | 12.17 (11.39–12.60) | 65.99 (63.55–75.40) |
| Search filter | 0.42 (0.17–0.49) | 2.70 (1.80–3.02) | 7.55 (7.43–7.85) |
| Category filter | 0.40 (0.13–0.42) | 1.39 (1.28–1.64) | 4.42 (3.97–12.36) |
| Date filter | 0.35 (0.31–0.44) | 1.03 (0.92–1.82) | 7.96 (7.90–8.08) |
| Perspective filter | 0.15 (0.15–0.19) | 0.40 (0.40–0.40) | 2.28 (2.28–2.51) |
| Categories model | 5.25 (4.94–5.34) | 19.53 (18.12–21.90) | 66.03 (63.92–78.22) |
| Current budget | 0.32 (0.29–0.36) | 0.60 (0.48–0.77) | 5.24 (4.57–5.27) |
| Budget comparison | 1.71 (1.68–1.78) | 9.09 (8.90–9.14) | 26.68 (24.74–26.76) |

### Split disclosure helper

The standard fixture has no splits. A temporary synthetic derivative added
parser-validated recorded-parent provenance with two-part groups, preserving
posting counts. Sparse cases contain two split parts; dense cases contain 20%
split parts. Exact returned sibling IDs were asserted before measurement.
Warmup: 100 calls; three measured batches of 100 calls.

| Postings | Density | Cold first lookup | Warm per-call median (range) |
| --- | --- | --- | --- |
| 1k | Sparse | 0.60ms | 0.008ms (0.008–0.012) |
| 1k | 20% | 0.25ms | 0.010ms (0.009–0.025) |
| 10k | Sparse | 2.68ms | 0.098ms (0.098–0.098) |
| 10k | 20% | 2.68ms | 0.105ms (0.103–0.108) |
| 50k | Sparse | 25.73ms | 2.215ms (2.174–2.246) |
| 50k | 20% | 17.19ms | 1.430ms (1.365–1.578) |

These are helper CPU timings, not DOM/render or interaction latency. The cold
call includes lazy dataset-index creation. At 50k, process snapshots were
96.5/176.9 MiB heap and 331.7/404.3 MiB RSS for sparse/dense cases; they are **not
peaks or isolated per-dataset memory deltas**. Retain the existing lookup until
representative interaction measurements demonstrate a material bottleneck.

## Complete UI-suite timing

Every run passed 502 tests across 91 files. Existing caches and per-file
isolation were retained. External elapsed time includes pnpm startup.

| Run | Workers | External elapsed | Vitest duration | Summed jsdom work |
| --- | --- | --- | --- | --- |
| 1 | 4 | 43.20s | 39.54s | 57.17s |
| 2 | 4 | 45.75s | 42.04s | 60.96s |
| 3 | 4 | 44.10s | 40.46s | 57.57s |
| Comparison | 2 | 75.30s | 68.75s | 50.74s |

Default median elapsed: 44.10s. The single two-worker comparison was 71% slower;
this is not enough to characterize every machine, but it does not support
reducing workers here. Keep `maxWorkers: 4` and isolation enabled.

```bash
/usr/bin/time -f 'EXTERNAL_ELAPSED_SECONDS=%e MAX_RSS_KB=%M' pnpm test:ui
# Repeat three times sequentially under the same runtime/dependencies.
# Separate isolated comparison:
/usr/bin/time -f 'EXTERNAL_ELAPSED_SECONDS=%e MAX_RSS_KB=%M' pnpm test:ui --maxWorkers=2
```

The original audit's approximately 39% jsdom figure represented aggregate
tracked work. Parallel environment durations must not be interpreted as
wall-clock startup share or used to justify weakening test isolation.

## Limits and follow-up triggers

- Wide/deep category-tree shapes and browser split rendering were not measured.
- No physical-phone or deployed/private-data performance claim is made.
- Revisit indexing only when representative measurements expose a material
  interaction bottleneck; compare the same fixture/runtime and financial outputs.
- Importer peak RSS is a separate workload and is not established by these
  analytics process snapshots.
