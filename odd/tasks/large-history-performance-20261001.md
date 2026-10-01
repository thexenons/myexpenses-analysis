# Large-history performance

Outcome: synthetic performance measurements delivered in 130e161; tested local
optimization candidates did not justify production changes. Independent P3
verification passed. No financial behavior, UI or cryptographic settings changed.

## Outcome and scope

Measure user-visible responsiveness with synthetic histories, optimize only
demonstrated bottlenecks, and retain identical financial results. The user
accepted this proposal with "Dale". Existing delivery preference is small
successive commits integrated into main; native candidate review consent remains
separate. No private vault, backups, environment files or production endpoint.

Baseline: fbc2019877e4dcd2c125b67b4c64e0b949269a43.
Branch: perf/large-history-20261001.

## Tasks

- [x] P1 — Establish reproducible synthetic measurements.
  Route: delegated writer; fixture, harness and measurement preparation spans
  multiple files. Measure 1k/10k/50k transactions, cold unlock and remembered
  unlock where applicable, search/filter/period/perspective changes, category
  trees and budget comparisons. Use desktop and throttled mobile-like Chromium;
  distinguish emulation from a physical-device measurement. Report medians and
  ranges, warmup/sample counts, actual posting counts and machine/runtime context.
- [x] P2 — Correct a demonstrated bottleneck, only if measurement supports it.
  Route: delegated writer for nontrivial logic. Strict RED/GREEN/refactor;
  compare before/after on identical fixtures and assert equal financial output.
  If no worthwhile bottleneck is established, record that and avoid speculative
  production changes. No crypto weakening, new dependencies or UI clutter.
- [x] P3 — Verify results and retain proportionate regression guards.
  Route: independent delegated verification, parent readback and spot check.
  Guard correctness and deterministic workload where possible; avoid fragile
  wall-clock assertions on ordinary CI. Assess actual review candidates and
  integrate authorized work units without including unrelated edits.

## Evidence and constraints

Source mapping: filtered derivations already share a bounded per-dataset cache;
do not claim duplicate consumer work without measuring it. Categories model
performs repeated filtering/aggregation and historical averages; that is only a
candidate for measurement, not an established performance defect.

Strict TDD enabled by AGENTS.md. Existing runners: Vitest, tsx --test and the
source-only isolated Playwright harness. Use installed Node 24 and dependencies.
Run focused tests, relevant domain/architecture checks, full UI when production
changes warrant it, all three TypeScript configs, Oxlint and diff checks.
No private build or network installation. Keep benchmark execution opt-in so
ordinary correctness tests do not inherit large or unstable performance workloads.

Forecast: 300–600 authored lines for measurement infrastructure, conditional
optimization size unknown until measurements exist. Work-unit commits tagged
[large-history-20261001]. Delivery: auto-chain, stacked-to-main semantics per
the existing direct-main preference; no PR requested. Line sizes are advisory,
not a reason to omit tests or compress readable code. RDD mode last observed on.

## Recovery

Engram mirror pending: runtime identity unavailable and agent memory calls
prohibited. Local document retained instead. Preserve unrelated dirty files:
.atl/.skill-registry.cache.json, .atl/skill-registry.md, odd/tasks/pcloud-cli-env.md.

## Progress

- Narrow source mapping completed without mutation or timing claims.
- Next: implement and run bounded opt-in synthetic measurements before selecting
  any production optimization.
- P1 completed after daemon recovery; existing edits/logs/process were inspected
  before resuming (no duplicated active runs). Opt-in source-only browser spec
  and Node harness use a validated imported seed with deterministic postings.
  Fixture sizes are 1k/10k/50k postings, including paired transfers and VOID;
  browser expectations use active postings, not raw record counts.
- RED evidence /tmp/p1-fixture-red.log, /tmp/p1-summary-red.log and
  /tmp/p1-browser-red.log; focused tests 2/2 GREEN, parent repeated 2/2.
  Node/app/browser/performance TypeScript configs, Oxlint and diff checks pass.
  Six size/project browser runs passed; default browser test list excludes the
  opt-in performance spec. Full ordinary browser suite not run for harness-only
  changes. No production code or crypto configuration changed.
- Baseline evidence: /tmp/p1-node-measure-final.json and
  /tmp/p1-browser-*/*/performance.json. Node samples: 1 warmup + 3 measured;
  repeated browser actions: 1 warmup + 2 measured (navigation-only sample noted
  separately). At 50k, validate+normalize median 466ms (459–477ms). On 390px
  Chromium with 4x CPU throttling, manual submit-to-ready scales from 1.44s (1k)
  to 3.39s (50k); remembered reload-to-ready from 0.64s to 2.78s. Browser numbers
  include automation/control waits and are not measurements on physical phones.
  Fixtures keep a small fixed category tree; these do not prove wide/deep-tree
  performance. Latency thresholds are deliberately absent from ordinary CI.
- Next: commit/assess P1, then profile the unlock stages to establish an actual
  root cause before selecting any optimization. P2 and P3 remain pending.
- P1 committed as 130e161 (605 authored lines), native high-risk review granted
  by the user and approved without findings; acknowledgement consumed
  review-f1c9c6cb62d9be0f. Integrated and pushed origin/main successfully.
  Next review boundary is 130e161. P2 begins with stage-level profiling; no
  production optimization has yet been selected.
- P2 completed as measured no-change. Isolated Node stage profile at 50k
  (1 warmup + 3 samples): manual derivation+decrypt median 86.8ms, remembered
  decrypt 1.5ms, surrogate gzip-to-text 303.0ms, JSON.parse 105.9ms, strict validation+freeze
  238.6ms, normalization 72.7ms. Synthetic content is 46.9MB JSON / 1.0MB gzip.
  Existing validated-object WeakSet avoids duplicate validation. These isolated
  CPU stages are not a precise decomposition of browser end-to-end latency.
  The gzip-to-text probe uses Response.text(), while production uses a bounded
  streaming TextDecoder; the 303ms value is NOT direct production attribution.
- Tested local alternatives did not justify a production edit: chunk-join text
  decoding 209.6ms versus 187.9ms baseline; no-copy array validation 239.2ms versus
  231.9ms baseline. Precomputed exact-key Set microbenchmark saved about 24ms
  (roughly 3% of profiled load), not a demonstrated material end-to-end gain.
  Evidence: /tmp/p2-stage-profile-baseline.json, /tmp/p2-decompress-compare.json,
  /tmp/p2-exactkeys-compare.json and /tmp/p2-validator-compare.json.
  Minified Chromium CPU profile did not reliably isolate rendering; no rendering
  attribution is claimed. No production change means no before/after financial
  equality claim is needed. Format changes/workers would require separate scope.
- Next: independent P3 measurement/fixture validation and documentation closure;
  preserve the no-change result unless concrete contrary evidence appears.
- P3 independent acceptance passed: fixture tests 2/2; strict fixture/transfer/
  VOID checks; Node 1k/50k rerun; default browser listing excludes performance
  (165 ordinary tests); default unlock/provenance/VOID/CSV smoke 2/2; 50k desktop
  and mobile-390 sequential browser runs both passed. All nine operation
  checksums and every recorded financial observation exactly matched P1.
  Parent repeated fixture tests 2/2 and structurally checked the final diff.
- Fresh 50k browser medians (desktop / 4x-CPU 390px, milliseconds): manual unlock
  1776 / 3591; remembered reload 802 / 2694; search 294 / 1549; perspective
  322 / 1069; date controls 353 / 1326; categories 171 / 538; budgets 132 / 523.
  These differences from P1 are run variation, not optimization gains. Each
  repeated browser interaction retains 1 warmup and only 2 measured samples.
- P3 evidence: /tmp/p3-node-measure.json, /tmp/p3-fixture-audit.log,
  /tmp/p3-browser-default-smoke.log and
  /tmp/p3-browser-50000-{desktop,mobile-390}/*/performance.json.
  Preserved 559-file manifest:
  1d60d5e7c5dec3a6c4c1e92a937de8649352ddcca8f6311e2469b32c0722569f.
  Full UI/browser suites and type/lint were not repeated by the independent
  verifier; P1 type/lint proof remains valid because only this record changed.
- P2/P3 close in one documentation-only work unit: no optimization was accepted,
  so no production regression or before/after improvement is claimed. No required
  implementation remains. Benchmark repeatability and correctness guards are
  delivered; broader format/worker/deep-tree investigations are separate work.

## Delivery and rollback

P1: 130e161, already pushed to origin/main after approved native review.
P2/P3: this passive closure records the no-change result and verification.
Reverting 130e161 removes only the opt-in harness and fixture changes; the closure
can be reverted independently. Never include unrelated dirty files or private
datasets. Engram task mirror remains pending under the runtime identity restriction.
