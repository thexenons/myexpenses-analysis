# Improve filtering efficiency and development vault freshness

## Scope and constraints

The user authorized a technical improvement iteration. A read-only audit sampled
domain calculations, presentation/state, accessibility, vault loading, build safety,
pCloud flows and verification tooling. Two reproducible issues are selected below;
this is not a claim of exhaustive application coverage.

Preserve financial semantics, VOID exclusion, budget availability, vault security,
existing UI and unrelated local edits. Use synthetic data only; do not read private
data, environment files, credentials or contact the user's localhost:5173 service.
No dependency upgrades, deployments or remote operations are part of this iteration.

## Execution and delivery

- Branch: `fix/technical-reliability-iteration`; base: `e65a364`.
- Strict TDD: enabled by project AGENTS; observe RED, GREEN, then refactor.
- Runners: installed Vitest for UI and `tsx --test` for Node/architecture tests.
- Route: delegated direct for both tasks (analysis and changes across implementation
  and regression tests). One writer at a time; parent owns tracking and commits.
- Forecast: approximately 250–350 authored changed lines including tests/tracking.
- Delivery strategy: `ask-on-risk`; work-unit commits, no PR or push authorized here.
- RDD: on (global). Initial reviewed boundary: `e65a364`. Assess each work unit.
- Engram mirror: pending; runtime session registration is unavailable, so memory
  writes are prohibited. Repository-relative recovery locator is this document.

## Tasks

- [x] T1 — Share equivalent filtered-analytics derivations across consumers without
  retaining an unlocked dataset globally or changing deferred-search behavior.
  Acceptance: equivalent consumers calculate once; changed inputs recalculate;
  locked/new datasets never reuse the previous dataset's result; existing outputs
  and presentation-only VOID handling remain unchanged.
- [ ] T2 — Include change time in the validated development vault cache identity.
  Acceptance: an in-place, equal-length overwrite with restored modification time
  returns newly validated bytes; unchanged files can reuse the cache; invalid new
  content never returns an earlier valid cached response.

## Verification

Per task: focused failing regression before code, passing focused suite, TypeScript,
Oxlint and `git diff --check`; parent spot-checks a reported command. Final checks:
full UI and source-only isolated Node/browser suites using synthetic fixtures.
Never run the full Node suite against this workspace's private data directory.
Runtime harnesses cover simultaneous hook consumers/deferred filters (T1) and
temporary synthetic vault files (T2). Rollback boundaries are the respective hook
derivation/tests and vault cache identity/tests; neither changes financial data.

## Progress and next step

Audit: duplicate per-consumer `applyFilters` confirmed in the shared shell/page;
stale vault cache reproduced with synthetic equal-length files and preserved mtime.
T1 uses a two-entry, dataset-keyed WeakMap so concurrent/deferred consumers can
share results without an unbounded history or a strong global dataset reference.
Observed RED: three added hook regressions failed from duplicate computations.
GREEN: focused Vitest 8/8, full UI 368/368 (84 files), all three TypeScript configs,
Oxlint (zero diagnostics), and diff check passed. Full UI emitted AppShell `act`
warnings without failing. Parent independently repeated focused Vitest: 8/8.
Implementation/test delta: 83 additions, 6 deletions; commit assessment pending.
Next: commit and assess T1, then implement T2 and run isolated final verification.
