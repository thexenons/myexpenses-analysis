# Frontend audit remediation

## Objective and scope

Remediate the five verified audit defects before the separate historical category-average change. Authorized local scope: production vault build/preflight and pCloud sync handoff; filtered budget copy; category/account flow timelines; previous-calendar-month comparison; and explicit vault reload UX, with focused tests and relevant local documentation. Do not inspect private datasets or credentials, add dependencies, perform remote operations, or implement the historical average here.

## Route and delivery

- T1 uses delegated direct implementation because it spans multiple non-trivial files. The parent owns commits, native review, direct-main delivery, and push; this worker makes no commit or remote change.
- Strict TDD is enabled by the session instructions. Runners: `pnpm test:node` via `tsx --test`, and `pnpm test:ui` via Vitest. Each defect must show a regression RED before production code changes, then GREEN and refactor.
- The ~400 authored changed-line work-unit guideline is advisory, not a code-golf cutoff. This cohesive security and UI remediation may exceed it. Delivery is direct main as expressly requested, without PR planning.
- Rollback boundary: revert this remediation unit's source, tests, and docs together; do not remove the unrelated category-average task document or any private data.

## Task

- [x] **T1 — Remediate five audited defects; functional verification complete, native review and delivery pending.**
  - [x] Production build authenticates exact bounded vault bytes with a validated nonempty phrase before Vite, binds and emits the same bytes, and rejects missing/malformed/mismatched/stale provenance without leaking secrets.
    - [x] Local wrapper rejects output targets containing the repository, vault, or phrase file; custom output must be outside the repository and absent or empty, and Vite is never forced to clear it.
  - [x] Filtered budget allocations avoid full-budget health claims and preserve unfiltered semantics.
  - [x] Category and account flow series share known date coverage and show zero gaps, respecting explicit and one-sided bounds.
  - [x] Previous-month comparison follows calendar-month selector semantics despite nonstandard accounting month start; custom ranges remain unchanged.
  - [x] Unlock UI explicitly reloads a replaced vault, while ordinary wrong-phrase retries retain the cached envelope and races/abort stay safe.

## Acceptance and verification

- Focused synthetic RED/GREEN tests for each defect; no private fixture read.
- `pnpm test:ui`, all safe nonreference Node tests (exclude only reference-data names), `pnpm type-check`, `pnpm lint`, `git diff --check`.
- Once at closure: `env -i PATH="$PATH" HOME="$HOME" pnpm test:deployment` synthetic harness; explicit synthetic local build through the new wrapper. Never run default build against real `data/`.
- Inspect final diff for accidental changes, secrets, and generated noise. Record exact passes, failures, skips, and commit identity (parent to fill).

## Progress and evidence

- Started on clean `main` at `f163b68`; working branch `fix/frontend-audit-remediation`.
- Engram mirror: pending until a successful write/readback (the session lacks a registered identity).
- Focused RED/GREEN: security preflight and Vite digest tests failed before implementation, then 14/14 focused Node tests passed; budget/timeline regressions failed 3 tests before their fixes, then 18/18 focused Vitest tests passed; calendar-month regression failed before its fix, then 9/9 comparison Node tests passed; vault retry repository/store/UI regressions failed before their fix, then 32/32 focused Vitest tests passed. Added race tests passed 34/34 focused Vitest tests after consolidation.
- Final checks: 26/26 source-inspected focused Node tests (build, sync, Vite, comparison); 227/227 full UI tests; `pnpm type-check`, `pnpm lint`, and `git diff --check` passed. Output-safety test first failed on the repository root and then passed with an injected builder; no destructive target was executed. Explicit synthetic local `pnpm build` passed again with a temporary private phrase file and vault/output paths; the isolated synthetic `pnpm test:deployment` harness passed 1/1 before the wrapper-only output-safety correction. No default build touched `data/`.
- Safety incident: an earlier broad Node run skipped two known reference-data test names but inadvertently executed `tests/domain/local-backup-parity.test.ts`, which read a local private backup. The 236-test command passed and printed only a parity-check count, not financial values. Do not repeat that broad run. Subsequent verification used inspected, scoped Node tests and source-scanned UI tests only; no private data was deliberately inspected.
- The current work unit is about 850 authored lines including new files (advisory heuristic exceeded for a cohesive security and UI correction). No PR or remote operation was made.
- Commit identity and native review: pending, owned by parent.
- Next: parent structural readback/native review, work-unit commit, then the separate historical average unit.
