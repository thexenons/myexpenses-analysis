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
- [x] T2 — Include change time in the validated development vault cache identity.
  Acceptance: an in-place, equal-length overwrite with restored modification time
  returns newly validated bytes; unchanged files can reuse the cache; invalid new
  content never returns an earlier valid cached response.
- [x] T3 — Use the environment-aware Testing Library `act` wrapper in AppShell
  tests and guard against the reproduced environment warnings. Preserve all lock,
  timer and expired-session behavior assertions; never silence console errors.
  Route: delegated direct (regression design and test edit); strict TDD applies.

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
T1 commit: `d7f5494` (150 authored changed lines including this document).
Assessment from `e65a364`: medium, `review_due: false`, `under_budget`; boundary
remains `e65a364`. No native approval is claimed.

T2 adds `ctimeMs` to the existing cache identity. Its two new regressions first
failed (stale response and missing invalid-file rejection), then passed with the
fix. Focused Node suite: 5/5; parent repeated 5/5. All three TypeScript configs,
Oxlint and diff checks passed. Source/test delta: 67 additions.
T2 commit: `6207976` (94 authored changed lines including tracking updates).
Combined assessment from `e65a364`: medium, 238 changed lines,
`review_due: false`, `under_budget`. Native review remains deferred; no approval
or candidate consent is inferred. Running work-unit total: 244 authored lines.

Independent final verification against T1 plus staged T2:
- Full UI: 368 passed across 84 files; 44 AppShell `act` environment warnings.
- Full Node: 283 passed; 3 optional private-data reference checks skipped.
- Full browser: 90 passed; 3 intentional viewport-specific skips.
- Three TypeScript projects, lint (zero diagnostics), staged/unstaged diff checks
  passed. No standalone deployment or real-data verification was run.
- UI/Node/type/lint ran in a 552-file source-only snapshot; browser used the
  existing 551-file isolated harness. Source hashes/modes, index and unrelated
  user edits were confirmed unchanged before/after verification.
- Evidence: `/tmp/technical-reliability-verify-0y1x4a76/commands.json`, `result.json`
  and `logs/`; source-manifest SHA-256
  `d3e63d807feeb2ece28f5404ce3b05c4e77f1700424e1626cf1b15b155c48333`.

T1 and T2 are complete and committed locally. No main merge,
push, deployment or external service operation was performed. Further technical
iterations should use new evidence rather than speculative refactors. Memory
mirror synchronization remains pending runtime registration.

## Continued iteration

The user requested another technical pass. Read-only checks of CSV export safety,
formatting/date boundaries, navigation/accessibility states and malformed CLI input
confirmed no new product defect (12 focused UI tests and 11 CLI tests passed).
The AppShell test file reproduced 44 environment warnings while passing 7 tests:
direct React `act` bypasses Testing Library's scoped environment setup. Synchronous
lock handlers and awaited assertions showed no evidence of premature completion.
T3 addresses this specific test-quality defect, not application locking behavior.
Acceptance: a regression fails on the warning before the import correction; focused
and full UI suites pass without those warnings afterward, with type/lint checks.
Forecast: approximately 40–70 further authored lines including tracking; below the
delivery threshold when combined with the current 245-line branch diff. Existing
`ask-on-risk` delivery policy and reviewed boundary `e65a364` remain unchanged.
T3 changes only `AppShell.test.tsx`: the Testing Library wrapper replaces direct
React `act`, with a call-through `console.error` guard and explicit spy cleanup.
RED: focused suite 6/7, with 11 captured warnings in the guarded test and 44 runtime
warnings overall. GREEN: focused 7/7, full UI 368/368 across 84 files, zero warnings;
all three TypeScript projects, Oxlint and diff check passed. Parent repeated 7/7.
Commands: `node node_modules/vitest/vitest.mjs run` (full and focused AppShell),
`node node_modules/typescript/bin/tsc -p <tsconfig> --noEmit` for node/app/browser,
and `node node_modules/oxlint/bin/oxlint --jsx-a11y-plugin --vitest-plugin --deny-warnings`.
Evidence: `/tmp/appshell-t3-red-f9ODWT/focused-red.log`,
`/tmp/appshell-t3-green-h3GngI/focused-green.log`,
`/tmp/appshell-t3-full-ui-vTc87p/full-ui.log`,
`/tmp/appshell-t3-checks-1aInjT/checks.log`.
Node/browser suites were not rerun for this test-only change; their previous
verification remains historical, not a new result. No app behavior was modified.
Rollback boundary: the AppShell test file. Source/test delta: 9 additions and
3 deletions. Next: commit and assess T3. Engram task mirror remains pending.
