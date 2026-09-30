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
