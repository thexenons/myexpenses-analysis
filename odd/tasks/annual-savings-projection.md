# Annual cumulative savings projection

## Objective
Show the projected cumulative real flow at every month end, January through December of the selected budget year, on Planning/Plans.

## Problem and scope
The page has budget pacing and historical income comparisons, but no annual savings trajectory. Complete months must use recorded real flow; incomplete/future months use expected monthly income minus the full monthly budget. Prefix-sum the monthly contributions. This is net flow since January, not an opening account balance.

## Authorized scope and constraints
- User authorized autonomous implementation, work-unit commits, and delivery pushed to main. Preserve unrelated edits to `.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`, and `odd/tasks/pcloud-cli-env.md`.
- User explicitly chose cumulative values and approved the income baseline: average income of complete months in the same budget year.
- Expected income includes already received income; never add the average on top of receipts. Disclose calculation assumptions in the UI. With no eligible historical months, do not invent a baseline.
- Reuse existing financial units, period resolution, coverage rules, and charts. Keep negative values and safe-integer checks. No dependencies, backup writes, or unrelated changes.
- Annual budgets use the established even monthly pacing basis, clearly labeled; monthly budgets resolve each month's allocation rather than repeating one selected amount. Expose incompatible currencies/filters or unavailable data honestly.
- Technical identifiers/comments/docs use English; UI copy follows the existing neutral Spanish UI.
- Strict TDD: enabled by supplied AGENTS.md. Require observed RED, GREEN, REFACTOR. Runner: `pnpm exec vitest run <target-test-file>`; project scripts below.
- Native review is on (global). Follow exact provider transitions; do not fabricate review results. User requests automatic grants, subject to the actual native consent contract.
- Remote destination/session must be explicitly authorized before external operations; no SSH/auth discovery.

## Tasks
- [ ] T01: Implement the pure annual projection and domain tests. Route: delegated; preparation and 2-file writer triggers. Cover same-year income mean, complete versus partial/future months, cumulative sums, annual/monthly budgets, zero/negative values, missing baseline and incompatible scope.
- [ ] T02: Integrate an accessible real-versus-estimated chart into Plans, add integration tests, verify and deliver. Route: delegated; multi-file writer trigger. Show month-end cumulative values, December total and concise income/budget assumptions; preserve existing budget controls and comparisons.

## Acceptance and verification
Focused domain/UI tests during RED/GREEN, then `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:browser` at integration closure. Report exact failed/unavailable/skipped checks. Inspect diff for user edits and private data. Each task closes with a Conventional Commit and evidence below; no AI attribution. Native candidate is a work-unit commit/slice, not the entire feature branch.

## Delivery and recovery
- Feature branch: `feat/annual-savings-projection`; branch point / first review boundary: `c86d1c4`.
- Initial authored-line forecast: approximately 300–400; revised T01 source/test size: 473 lines because cutoff, signed-income, coverage, and overflow regressions require durable proof. Keep coherent units and tests; do not code-golf to fit a planning heuristic.
- Delivery strategy: `ask-on-risk`; no PR requested. Push/merge are explicitly authorized, once target/session scope is resolved.
- Running authored lines: 0. Review outcomes / slice boundaries: pending.
- Rollback boundary: new annual projection module/tests plus isolated Plans wiring/chart; preserve all other financial calculations.

## Progress and evidence
Exploration completed read-only. Imported data has no scheduled income; user approved same-year complete-month mean. Local main and prior feature branch are both at the branch point. New feature branch created; unrelated edits preserved.

### T01 functional evidence (commit pending)
- Pure domain module and 16 behavioral tests implemented.
- Observed initial RED: 9 failing stub tests; initial GREEN: 11 passed.
- Independent verification found today's receipts excluded and absent receipts clamping negative means. Regression RED: 3 failed / 12 passed; final GREEN: 16 passed, including value-date and overflow coverage.
- Writer: `pnpm type-check` and `pnpm lint` passed; `pnpm test` passed (Node 324 passed, 3 skipped; UI 493 passed / 90 files).
- Parent spot check: focused Vitest 16/16 passed; `git diff --check` clean.
- Earlier sandbox IPC failure is environmental and superseded by successful unrestricted runs. Build/browser are N/A for the pure-domain unit and pending T02.
- Rollback: remove only `src/domain/analytics/annual-projection.ts` and `.test.ts`.
- Engram mirror pending: resume hook reported no authoritative registered identity; all agent-attributed memory writes are paused until runtime registration is restored. Local progress remains authoritative and must be mirrored later.

## Next step
Delegate T01, observe TDD and focused checks, read back changes, commit the work unit, then follow native assessment/review before integration.
