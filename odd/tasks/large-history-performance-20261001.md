# Large-history performance

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
- [ ] P2 — Correct a demonstrated bottleneck, only if measurement supports it.
  Route: delegated writer for nontrivial logic. Strict RED/GREEN/refactor;
  compare before/after on identical fixtures and assert equal financial output.
  If no worthwhile bottleneck is established, record that and avoid speculative
  production changes. No crypto weakening, new dependencies or UI clutter.
- [ ] P3 — Verify results and retain proportionate regression guards.
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
