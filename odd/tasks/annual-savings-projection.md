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
- [x] T01: Implement the pure annual projection and domain tests. Route: delegated; preparation and 2-file writer triggers. Completed in `3f8b4b31bdb33dc0885be392494e7f9af29f9eb6` with 16 tests and independent verification.
- [x] T02: Integrate an accessible real-versus-estimated chart into Plans, add integration tests, verify and deliver. Route: delegated; multi-file writer trigger. Implementation `ba11ffa`; source and recovery commits delivered to `origin/main` at `772b74d` by observed successful non-force push.

## Acceptance and verification
Focused domain/UI tests during RED/GREEN, then `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:browser` at integration closure. Report exact failed/unavailable/skipped checks. Inspect diff for user edits and private data. Each task closes with a Conventional Commit and evidence below; no AI attribution. Native candidate is a work-unit commit/slice, not the entire feature branch.

## Delivery and recovery
- Feature branch: `feat/annual-savings-projection`; branch point / first review boundary: `c86d1c4`.
- Initial authored-line forecast: approximately 300–400; revised T01 source/test size: 473 lines because cutoff, signed-income, coverage, and overflow regressions require durable proof. Keep coherent units and tests; do not code-golf to fit a planning heuristic.
- Delivery strategy: `ask-on-risk`; no PR requested. Push/merge are explicitly authorized, once target/session scope is resolved.
- Running authored lines: 877 through T02 (521 in T01; 356 in T02 including recovery updates). Review boundary advanced from `c86d1c4` to `3f8b4b3` after the native acknowledgement. T02 is a separate work-unit slice, not a combined branch review.
- Rollback boundary: new annual projection module/tests plus isolated Plans wiring/chart; preserve all other financial calculations.

## Progress and evidence
Exploration completed read-only. Imported data has no scheduled income; user approved same-year complete-month mean. Local main and prior feature branch are both at the branch point. New feature branch created; unrelated edits preserved.

### T01 functional evidence
- Pure domain module and 16 behavioral tests implemented.
- Observed initial RED: 9 failing stub tests; initial GREEN: 11 passed.
- Independent verification found today's receipts excluded and absent receipts clamping negative means. Regression RED: 3 failed / 12 passed; final GREEN: 16 passed, including value-date and overflow coverage.
- Writer: `pnpm type-check` and `pnpm lint` passed; `pnpm test` passed (Node 324 passed, 3 skipped; UI 493 passed / 90 files).
- Parent spot check: focused Vitest 16/16 passed; `git diff --check` clean.
- Earlier sandbox IPC failure is environmental and superseded by successful unrestricted runs. Build/browser are N/A for the pure-domain unit and pending T02.
- Rollback: remove only `src/domain/analytics/annual-projection.ts` and `.test.ts`.
- Native assessment: medium, review due `slice_budget_reached`; one provider-selected reliability review. Candidate consent granted under the user's explicit request for automatic grants. Review found no blocker; lineage `review-4ca32de600d1a275` closed by exact acknowledgement (no fabricated PASS).
- Engram mirror pending: resume hook reported no authoritative registered identity; all agent-attributed memory writes are paused until runtime registration is restored. Local progress remains authoritative and must be mirrored later.

### T02 implementation and verification
- Added the isolated AnnualProjection panel, full-year cumulative chart, December total, exact monthly contribution/cumulative table, real/estimated labels, assumptions, and distinct unavailable/calculation-error messages. Existing controls and comparisons are unchanged.
- Hook and view integration, component/page/hook tests, and synthetic browser fixture/scenario implemented. UI neutral Spanish follows existing project copy.
- Observed UI RED: 4 failed / 21 passed; final focused GREEN: 43 passed. Parent spot check independently passed 43/43.
- Writer `pnpm type-check`, `pnpm lint`, and `pnpm test` passed (Node 324 passed, 3 skipped; UI 499 passed / 91 files).
- Independent full browser matrix: 195 passed, 3 existing viewport-specific skips, exit 0. Production static build succeeded with isolated synthetic vault data through `runBuildStaticCli`; direct private-data `pnpm build` was deliberately not run.
- New scenario passed at 1280px, 390px, and 320px with keyboard disclosure, scoped axe checks, and overflow assertions. Parent visually inspected the 320px screenshot; mobile grid uses `minmax(0, 1fr)` to avoid min-content overflow.
- Environmental outcomes preserved: initial 300s timeout; pretest EADDRINUSE from its orphan server (owned process removed); fresh-shell missing libnspr4.so. Corrected supported runtime-library environment yielded full browser success in 10m02s. No assertion failures occurred in those environmental attempts.
- Browser command: `MYEXPENSES_BROWSER_RUNTIME_LIB_DIR=/tmp/saracastello-browser-libs.hDbDUm/root/usr/lib/x86_64-linux-gnu timeout --signal=TERM --kill-after=15s 900s pnpm test:browser`. Evidence log: `/tmp/annual-projection-verify.vFhzu5.log`; screenshots: `/tmp/myexpenses-annual-projection-{desktop,mobile-390,narrow-320}.png`. These are temporary, synthetic artifacts, not committed data.
- Source/test diff: 335 authored lines. Rollback: remove the new AnnualProjection component and isolated BudgetsPage wiring/tests plus the new synthetic fixture/scenario; T01 domain logic remains independently valid.
- Implementation commit: `ba11ffaf03cc161343ef537dc36e036ca7f79813`. Native assessment of its exact range against `3f8b4b3`: medium, 356 lines, `review_due: false`, reason `under_budget`. No review was started or approval fabricated for that range; functional verification is complete and the native slice remains pending under its threshold policy.
- User explicitly authorized synchronization and push to `origin/main` using configured repository Git authentication. Fetch confirmed remote main at `c86d1c4`; local main fast-forwarded to `772b74d`. Observed `git push origin main` exit 0: `c86d1c4..772b74d main -> main`. No force, rebase, history rewrite, PR, or deployment performed. Unrelated edited files remained untouched.

## Final state
Both implementation tasks are complete and source delivery is verified. Exact tests, environmental failures, resolved regressions, native review outcome and residual unsupported scopes are recorded above. Historical Engram mirror is deliberately stale/pending: do not trust its original unchecked tasks over this repository document until the runtime restores session attribution and the full document can be mirrored.

## Next step
Publish this passive delivery record through the same authorized non-force main push and verify local/remote identity. No further source work is required. Resynchronize the Engram mirror only when the host restores the authoritative session identity; do not invent or register one.
