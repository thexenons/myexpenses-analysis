# Synthetic large-history measurements

These opt-in workloads use the repository's synthetic importer fixture and add
deterministic postings. They never read a real backup or vault. Use Node 24 and
the already-installed dependencies; keep JSON output outside the repository.

```bash
TZ=Europe/Madrid node node_modules/tsx/dist/cli.mjs \
  tests/performance/measure-large-history.ts \
  --counts=1000,10000,50000 --warmups=1 --repeats=3 \
  --output=/tmp/myexpenses-node-performance.json

for count in 1000 10000 50000; do
  MYEXPENSES_PERF_COUNT="$count" \
    node node_modules/tsx/dist/cli.mjs tests/browser/run-isolated.ts \
    tests/browser/large-history-performance.spec.ts \
    --project=desktop --project=mobile-390 \
    --output="/tmp/myexpenses-browser-performance-$count"
done
```

The browser runner needs a locally installed Chromium. Set
`PLAYWRIGHT_BROWSERS_PATH` to an existing cache outside the repository if it is
not in the default location. On hosts missing Chromium system libraries, set
`MYEXPENSES_BROWSER_RUNTIME_LIB_DIR` to an existing external library directory.
Do not install packages or use a private data source to run this workload.

Each browser run records `performance.json` in the test output directory.
`mobile-390` means a 390px viewport with 4× Chromium CPU throttling, **not** a
physical phone. The first browser interaction is a warmup where repeats follow;
the initial manual-unlock sample also represents the first cold vault unlock.
One-off navigation records one sample without a warmup. Reported times are
observations (median and range), not pass/fail thresholds. Fixture counts and
financial checksums accompany the Node measurements. Compare runs on the same
machine, runtime, browser, and fixture before attributing a change to code.

## Fresh-process import memory

The import workload builds its own SQLite/ZIP fixtures; it accepts **no input
backup path** and never reads a private backup. Run it only when measuring import
resources, not as a routine unit-test benchmark:

```bash
pnpm exec tsx tests/performance/measure-import-memory.ts \
  --counts=1000,10000,50000 --warmups=1 --repeats=3 \
  --output=/tmp/myexpenses-import-memory.json
```

Omitting `--output` chooses a unique JSON filename in the system temporary
directory. Explicit output must have an existing parent outside the repository,
including resolved symlink parents. Existing files are refused rather than
overwritten. Owned fixture directories and incomplete reports are removed when
children fail; completed reports remain for comparison.

### Interpret the measurements

- Each size has a fresh fixture-generator process. Its `generationMs` and
  `peakRssBytes` are **setup measurements**, not import measurements. SQLite
  inserts use bounded 1,000-row batches to avoid giant-statement sql.js/WASM
  failures. This is a fixture implementation detail, not a production size limit.
- Every warmup and retained sample imports the ZIP in a fresh process. Warmups
  can warm filesystem/loader caches, but do not create a warmed in-process
  importer. `importMs` wraps `importBackup`: ZIP reading/checks, SQLite parsing,
  mapping, validation, serialization and atomic output. Module startup precedes
  that timer. `roundTripMs` also includes Node/tsx startup, module loading, output
  checksum/count validation, IPC and process termination.
- `peakRssBytes` captures the process high-water mark **through import**, before
  rereading JSON for assertions. It includes runtime/module startup, native/WASM
  allocations and buffers, not just JavaScript heap. It is not an incremental
  allocation measurement or a single RSS snapshot. Node reports `maxRSS` in
  KiB (1,024 bytes); the harness multiplies by 1,024. Summaries use `min`,
  `median` and `max` within fields whose names identify milliseconds or bytes.
- The fixture has exactly the requested count of direct EUR transactions on
  one account, alternating -100 and +200 minor units. The imported posting
  count and sum are asserted, and serialized SHA-256 must agree across fresh
  imports. Four accounts, four categories and one budget remain from the seed.
  There are no attachments, splits, debt activity, FX activity or large trees.
- CLI bounds are one to three distinct counts from 1–50,000, 0–2 warmups and
  1–5 repeats; `--timeout-ms` is bounded from 1,000–600,000 ms and defaults to
  600 seconds per child. These protect the opt-in
  workload, not legitimate production backups. Production archive caps remain
  64 MiB ZIP, 128 MiB database and 512 MiB total expanded entries. Fixture byte
  sizes are recorded separately from RSS; archive caps are not memory promises.

[Node resource-usage units](https://nodejs.org/docs/latest-v24.x/api/process.html#processresourceusage).

### Completed measurements (2026-10-03)

Both baseline and optimized matrices completed on the same Node 24.19.0,
Linux x64 environment: one discarded fresh-process warmup and three retained
fresh-process imports per size, with a 600-second child bound. The optimization
skips both correlated sibling subqueries when the outer transaction's parent ID
is NULL; non-null predicates and all-row sibling semantics remain unchanged.
At 50k, median fixture import latency improved **103.21×**. This is a latency
gain for this direct-transaction fixture, **not a memory gain or a prediction
for real backups**.

Tables show retained-sample **median (minimum–maximum)**. Import timing excludes
module startup; RSS is process high-water through import, not heap or incremental
memory. See the methodology above for the separate startup-inclusive timing.

| Source transactions | Baseline import seconds | Optimized import seconds |
| --- | --- | --- |
| 1,000 | 0.280 (0.277–0.303) | 0.165 (0.164–0.169) |
| 10,000 | 11.460 (11.408–11.478) | 0.732 (0.723–0.737) |
| 50,000 | 296.148 (291.861–303.238) | 2.869 (2.866–2.885) |

| Source transactions | Baseline peak RSS MiB | Optimized peak RSS MiB |
| --- | --- | --- |
| 1,000 | 121.270 (119.992–121.680) | 121.367 (120.434–121.379) |
| 10,000 | 224.883 (223.266–226.625) | 222.699 (222.016–223.426) |
| 50,000 | 519.348 (518.152–521.418) | 521.535 (519.785–521.539) |

The ZIP, SQLite database, total expanded entries and serialized JSON sizes were
unchanged between matrices. Values below are **bytes**, not process memory.

| Source transactions | ZIP | Database | Expanded entries | Output JSON |
| --- | --- | --- | --- | --- |
| 1,000 | 9,169 | 147,456 | 148,349 | 891,885 |
| 10,000 | 61,064 | 884,736 | 885,629 | 8,888,389 |
| 50,000 | 307,593 | 4,231,168 | 4,232,061 | 44,468,392 |

All 12 optimized outputs, including warmups, were byte-identical to baseline
according to SHA-256 and output size. Posting counts, signed EUR minor-unit sums
and the four-account/four-category/one-budget counts also matched. Both completed
reports confirmed owned-fixture cleanup.

Fixture generation used its own fresh child per size, outside the measured
importer. These are **single setup observations**, not import medians or part of
the latency gain; generator high-water RSS is not added to importer RSS.

| Source transactions | Baseline generation ms / peak MiB | Optimized generation ms / peak MiB |
| --- | --- | --- |
| 1,000 | 50.031 / 94.250 | 50.386 / 94.824 |
| 10,000 | 103.437 / 102.242 | 96.301 / 102.469 |
| 50,000 | 288.732 / 154.926 | 291.894 / 154.992 |

### Resource envelope and limits

The initial 120-second run timed out on the first 50k import and published no
complete report. That historical timeout was superseded by the complete baseline
and optimized 600-second runs above; it is not vulnerability evidence. A separate
real-child run with a 1,000 ms bound verified failure cleanup, beyond the mocked
cleanup regression.

Keep production caps unchanged: 64 MiB ZIP, 128 MiB database and 512 MiB total
expanded entries. These measured fixtures are well below those archive limits,
yet 50k importer RSS exceeded 500 MiB. Plan host resources using process memory,
not ZIP size; these observations are not a guaranteed maximum or a tighter
production acceptance limit. Split-heavy or FX-heavy histories, attachments,
wide/deep category trees and near-limit archives remain unmeasured. Those shapes
need their own measurements before generalizing this supported local envelope.
