# Annual cumulative savings projection

## 2026-10-03 resumed work
- User authorized finishing recorded pending work before audit improvements.
- Reconciled current repository with the historical Engram snapshot: T01/T02 are complete; T03 is the actual pending behavior. Local HEAD/main are at `48c4a54`; cached remote refs are not fresh remote-delivery proof.
- T03 remains delegated direct (multi-file behavior/tests). Preserve unrelated dirty registry and pCloud evidence. Current authorization does not add remote delivery.
- Use the existing annual trajectory browser scenario and inline synthetic fixture; no new harness is required.
- Historical browser runtime library directory is absent. Resolve the local verification prerequisite without changing global packages, or report browser proof blocked.
- Engram recovery mirroring is now available through the registered runtime session; previous mirror-pending notes are historical.

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
- [x] T03: Support selected budgets with account/category restrictions while preserving global real flow and income. Route: delegated; preparation and multi-file behavioral regression triggers. User explicitly approved this correction after reporting the unsupported-scope message. Verified locally on 2026-10-03; commit and assessment recorded below.

### T03 authorized correction
- Remove the selected budget's account/category restriction as an availability blocker. Closed months still use global real flow; estimated months still use global same-year income minus the full selected budget allocation. The budget's own restrictions must not filter projection income or real flow.
- Preserve application-level content-filter and incompatible-currency guards, completed-month coverage, inclusive today cutoff, signed values, monthly allocation resolution, and cumulative arithmetic.
- Explain the global-flow/selected-budget basis in existing neutral Spanish UI copy. Remove the obsolete unsupported-budget-scope reason and message; add domain and UI/browser regressions for account/category-restricted budgets.
- Current fix authorization covers local implementation and feature-branch work-unit commits only. Original main delivery was completed at `48c4a54`; a new remote delivery requires explicit authorization.
- Fix branch: `fix/annual-projection-budget-scope`; branch point and first native review boundary: `48c4a5406b64950f1714b6dfdf4b95cfc1b4cc1a`. Forecast approximately 100–200 authored lines; delivery strategy remains `ask-on-risk`, no PR requested.
- Applicable test-first policy: observe runnable deterministic regression RED before implementation, then GREEN and refactor. Verification: focused domain/component Vitest, `pnpm type-check`, `pnpm lint`, `pnpm test`, and the isolated synthetic annual-projection browser scenario at all three configured widths. The browser runner also exercises the isolated production build; do not load private vault data for a direct build.
- Native RDD mode is on (global). Assess the committed fix against its own branch point; follow exact returned transitions and the current candidate-consent contract. Historical automatic grants are not a fabricated approval for this fix.
- Engram mirror remains pending because runtime session registration is unavailable; do not perform agent-attributed memory writes.

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
Original implementation tasks T01/T02 and their main delivery are complete. T03 is implemented and locally verified; no new remote delivery is authorized. The full Engram task mirror was restored using the authoritative runtime identity on 2026-10-03.

## Next step
Close the local T03 work-unit commit and native assessment, then continue the accepted audit opportunities. Request explicit authorization before any new remote delivery.

### T03 implementation and verification (2026-10-03)
- Removed the obsolete selected-budget scope availability guard and reason, leaving global flow/income and complete selected allocation arithmetic unchanged. Added neutral Spanish calculation-basis disclosure.
- Added independent account/category-restricted domain cases and browser fixtures that exclude salary from the selected budget scope, preserving global table rows and income baseline.
- Observed focused RED: 4 failed / 17 passed; GREEN: 21 passed. No further production refactor was necessary.
- Writer: type-check and lint passed; full suite Node 324 passed / 3 optional private-reference skips, UI 502 passed. No private data was loaded.
- Parent independently reran focused Vitest: 21 passed; structural diff readback and diff check clean.
- Independent verifier: focused Vitest 21 passed; isolated annual trajectory browser scenario 3/3 at desktop, 390px, 320px (24.3s), including synthetic production build, keyboard/axe/overflow and equality regressions; synthetic deployment pipeline 1/1 (22.6s). Full browser matrix remains a separate pending audit verification item.
- Browser prerequisite resolved through public apt packages extracted into temporary local directories, without global installation. Supported runtime environment: `MYEXPENSES_BROWSER_RUNTIME_LIB_DIR=/tmp/myexpenses-browser-libs.ayxt79/root/usr/lib/x86_64-linux-gnu`. No orphan processes remain.
- Source/test diff: seven files, +71/-7 = 78 authored lines. Rollback only this scope guard removal, disclosure and its regressions; preserve T01/T02 and unrelated edits.
- Work-unit commit and committed assessment: pending below; current uncommitted assessment medium/under-budget includes unrelated registry changes and is not the fix-only assessment.
