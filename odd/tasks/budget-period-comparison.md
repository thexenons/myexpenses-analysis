# Compact budget period comparisons

## Objective and authority

Implement the approved Budgets proposal: readable category rows with current
spending against the budget, a selected prior/reference period and period-average
spending, without expanding each node into a large card. Preserve transaction
inspection and put secondary metrics behind an explicit details action.

The user approved implementation after reviewing the proposal. Standing delivery
instruction: small successive deliveries integrated and pushed to `origin/main`
after each verified task. No pull requests, deployment or private-data access.

## Scope and decisions

- Keep current budget calculations unchanged; reference/average consumption must
  use the same account, currency, perspective, budget and global non-date filters.
  Preserve refunds, VOID exclusion and the existing targeted debt-mirror rules.
- Show category, current/budget with a slim utilization bar, primary reference and
  mean at a glance. Align columns on desktop; compact grouped lines on mobile.
  Keep readable text and touch targets; do not force fixed heights or hide values.
- Details contain available amount, rollover, allocation source, complete deltas,
  other selected references and mean provenance. Tree expansion, details and
  transaction inspection remain separate keyboard/touch actions.
- Default reference: previous compatible budget period. Allow multiple selected
  references with one primary. Full reference-period totals are explicit; any
  same-elapsed-date comparison is separate and must not alter current totals.
- Mean: compatible complete periods before the selected target period, bounded
  by available history and today. Zero-activity periods count; current/future or
  partial edge periods do not. Explain dates/unit/count once above the tree.
  Do not silently copy the generic Categories net-EUR mean or its fallback.
- Preserve budget accounting month/week starts. A custom `NONE` grouping has no
  implied mean unit: use explicit reference dates and disclose unsupported mean,
  rather than fabricate a monthly average. Distinguish no history from zero.
- Show income comparison separately from expense consumption and utilization.
  Parent/child rollups must not double-count categories.

## Tasks and acceptance

- [x] B1 — Compact existing budget rows and move secondary metrics into an
  initially closed, accessible details disclosure. Preserve exact existing
  values, filtered-cut labels, tree expansion and consumed-posting dialog.
  This independently useful first delivery does not invent comparison values.
- [x] B2 — Add a budget-scoped reference/mean model with synthetic regressions
  for period boundaries, available history, zero activity, refunds, VOID, each
  perspective, scope/currency, hierarchy and separate income totals.
- [x] B2a — Guard integer-baseline comparison deltas against unsafe minor-unit
  subtraction, preserving fractional historical means. Add boundary regressions.
  Separate follow-up to non-blocking native advisory R3-001; never reopen B2.
- [x] B3 — Connect reference controls and mean context to the page and compact
  rows. Keep primary reference and mean visible on mobile; show one relevant
  textual comparison signal and disclose additional periods/deltas/provenance.
  Verify reference changes, empty states, period changes and transaction access.
- [x] B3a — Preserve the current budget view when comparison arithmetic rejects
  out-of-range history. Add observed RED/GREEN hook regressions for the error
  state and intact base model. Separate follow-up to native advisory R3-001;
  do not reopen the approved B3 candidate.
- [ ] B4 — Add/execute isolated responsive and interaction regressions at
  desktop, 390px and 320px across Real/Yo/Deudas. Verify useful readable amounts,
  nested categories, details, keyboard focus, no overflow and no runtime errors.

## Route, TDD and delivery

- Delegated direct for all tasks: mapping spans domain, hooks, view, row and CSS;
  each implementation needs multiple coordinated non-trivial files. One writer;
  parent owns this record, commits, native review and delivery. No SDD selected.
- Strict TDD enabled by project AGENTS. Observe RED before implementation, then
  GREEN and refactor. Runner: installed Vitest
  (`node node_modules/vitest/vitest.mjs run <focused test paths>`).
- Branch: `feat/budget-period-comparison`; branch point: `e389b3c`.
- Last reviewed boundary: `a37eabc` (passive bookkeeping after acknowledged B3).
  RDD is on (global); assess each new work-unit commit and follow
  exact native transitions/consent when due. B2a routes delegated direct because
  financial arithmetic and regression tests need coordinated edits.
- Delivery strategy: `auto-chain`, `stacked-to-main`; B1, B2, B3 and B4 are the
  planned delivery boundaries. Revised forecast roughly 2,600–3,300 authored
  lines across all tasks including tests/docs, not a hard task limit. Keep cohesive changes;
  do not remove tests, compress code or split artificially for a line budget.
- Engram mirror pending: no authoritative registered runtime session identity.
  Agent-attributed memory tools are prohibited; this file is the recovery record.

## Verification and safety

Per task: focused synthetic tests, relevant TypeScript projects, Oxlint and
`git diff --check`; parent repeats one reported command. Broaden UI/domain tests
with blast radius. B1/B3/B4 require isolated synthetic browser checks and visual
inspection, never the user service on localhost:5173. Full UI and all three
TypeScript projects run before final delivery. Only run Node/build checks inside
source-only snapshots when applicable; never expose real data or `.env`.

Safe focused row/page command:
`node node_modules/vitest/vitest.mjs run src/presentation/pages/BudgetsPage/BudgetsPage.test.tsx src/presentation/pages/BudgetsPage/components/BudgetAllocationTable/BudgetAllocationTable.test.tsx src/presentation/pages/BudgetsPage/BudgetsPage.helpers.test.ts`.

Browser harness: `node node_modules/tsx/dist/cli.mjs tests/browser/run-isolated.ts`
with a bounded relevant grep, staged tracked inputs, sanitized environment and
short temporary paths. Do not install dependencies or change security settings.

Preserve pre-existing edits in `.atl/.skill-registry.cache.json`,
`.atl/skill-registry.md` and `odd/tasks/pcloud-cli-env.md`.

## B1 verification and next step

B1 is functionally and visually verified. Current/assigned amounts form one group;
Details is an independent keyboard-operable disclosure beside the category. An
opt-in inline meter preserves existing callers and full accessible names. The
row adapts to available container width, including sidebar and tree indentation.
No financial calculation or comparison/average value changed in this delivery.

Strict TDD evidence:
- Initial behavior RED: 3 failures before source changes (22 other tests passed),
  `/tmp/b1-red-valid-tqKh69/`.
- Density RED: 126px closed desktop row exceeded the 95px target,
  `/tmp/b1density-red-WInUoO/`.
- Intermediate-width RED: at 900px the child had scrollWidth 573 vs clientWidth
  571 before the container-query correction, `/tmp/b1contain-red-rdUFJ8/red.log`.

Final checks:
- Focused UI: 25/25; full UI: 378/378 across 84 files.
- TypeScript node/app/browser, Oxlint (zero warnings/errors), whitespace: passed.
- Final durable compactness browser regression: 3/3 primary viewport projects,
  plus sequential 1024/900/768 local containment assertions in desktop coverage.
- Prior 15/15 budget browser cases passed before the final CSS-only correction;
  the independent final detached probe passed 9/9 on the corrected bytes.
- Final probe covered Real/Yo/Deudas amounts, transaction IDs, Details and tree
  independence, keyboard activation, dialog focus return, readable text, touch
  targets >=44x44px, no local/document overflow and no page errors.
- Parent repeated focused 25/25 after the final correction and inspected layout.

Typical closed parent/child rows: 69/69px desktop, 90/90px at 900px,
139/139px at 390px, and 139/154px at 320px (Real). Both narrow fixture rows fit.
The former 900px overflow is resolved: child widths 571/571px, including stress.

Final writer logs: `/tmp/b1contain-red-rdUFJ8/*-final.log` and
`green-primary.log`. Parent evidence: `/tmp/b1p3-2c5nfq/`. Independent final
probe/screenshots/manifests: `/tmp/b1z-3bsjmtom/`; source manifest SHA-256:
`f99e5b3f7204e13cf6c2d4c34ec48111123405571be8c9e06ec26198fa9c8e96`.
Source/index and protected user edits were preserved. Limitation: synthetic
fixture has two visible categories; extreme long-name/million-amount stress was
DOM-only and necessarily grows taller, without clipping. No full Node suite,
build, real financial data or manual screen-reader audit was used.

Rollback boundary: BudgetAllocationTable Item/CSS/test, BudgetUtilization
component/types/CSS, BudgetsPage.test.tsx and the scoped regression added to
`tests/browser/financial-explainability.spec.ts`. Source/tests: 367 authored lines.
B1 commit: `a9446ebace021e03d59f66aa208b64a5cb0e5094` on the feature branch;
505 authored lines including this recovery document. Commit hooks did not change
the staged tree (`bc3c104f2633968b42434fc226899f0701be0c28`).

Native review from the prior boundary `2f233a7`: medium, 12 paths, 707 authored
lines including the CSV under-budget slice. The user granted this candidate's
review. The provider reliability reviewer inspected all 12 immutable patches,
reported no findings and did not execute tests. Exact acknowledgement succeeded:
`review-1a4cf0c4a0e9d23f`, target
`sha256:765402368a25e6231ac6b7d170d3d56c04e9dabc1b167c6c937953186a2de242`,
authority burned. This transaction is closed and must not be resumed or reused.

B1 plus verification bookkeeping `19e0b451cc3ab0243eef6de9c0491d8c5a39e1c9`
were fast-forwarded and pushed to `origin/main`; the actual remote ref matched.
Bookkeeping assessment: passive, 20 authored lines, review not due. Returned to
`feat/budget-period-comparison` for B2; unrelated user edits remain untouched.

## B2 verification and next step

B2 adds the pure `analyzeBudgetPeriodComparison(dataset, analysis, filters,
options)` model in `src/domain/analytics/budget-period-comparison.ts`, with
explicit today/reference selection, category/global deltas, separate scoped
income and complete-period historical mean/provenance. No page wiring yet.
`budgets.ts` shares calendar resolution and scoped contribution collection;
current budget outputs remain unchanged in differential verification.

Semantics retained: historical allocations are not required; the mean uses all
covered compatible complete periods before the target/today, not only selected
references. Covered zero-activity units count, partial edges do not. References
outside coverage or not yet complete are unavailable, not zero. Custom NONE
accepts explicit ranges but has no inferred average unit. Income means signed
INCOME-category postings in the same budget/filter scope, not expense mirrors.

Strict TDD: 12 comparison cases failed against the unsupported stub before
financial logic; all 31 existing budget tests passed. A later global-reference
change test also failed before its fix. Evidence:
`/tmp/b2-red-wbMZg7/{behavior-red.log,global-delta-red.log}`.
Final writer checks in that directory (`*-final.log`):
- Focused existing/new domain tests: 45/45 (31 existing + 14 new cases).
- Full synthetic UI/domain suite: 392/392.
- TypeScript node/app/browser, Oxlint (zero warnings/errors), whitespace: passed.
- Parent repeated focused 45/45: `/tmp/b2p-RfL7Vr/`.

Independent functional verification: focused 45/45 and detached synthetic probe
6/6, with 74,890 assertions. It covered 1,960 calendar cases, every valid month
start 1–31/week start 1–7, 15,680 contiguous backward predecessor steps, 20 mean
scenarios and 135 differential scope/perspective scenarios. Entire current
analyses matched baseline `19e0b45`; reference/category totals matched current
analysis, including refunds, debt mirrors, VOID, neutral activity and value dates.
Evidence: `/tmp/b2v-o1rexp_j/` (commands, logs, probe, summary and preservation).
553-file source manifest SHA-256:
`ee9346361e1c99205211f6eb06cfb3a1a558cb13da908e5ea79e620f62b64f62`.
Candidate source matched the index; source, index, HEAD and protected files stayed
unchanged. Limits: synthetic normalized inputs only; no import/private-data
checks, full Node suite, build or browser run for this pure-domain unit. B3/B4
will verify the presentation integration separately.

Rollback boundary: `budgets.ts`, `budget-period-comparison.ts` and its test.
Source/tests: 731 authored lines. This exceeds the planning heuristic because
shared scope, calendar/reference/mean behavior and 14 regression cases form a
single coherent domain model; no PR is being created and tests were not trimmed.
B2 commit: `4b5c18be000f5099f75f35996330861552a9dd6f`; 790 authored lines
including task-document updates. Staged and committed trees matched exactly:
`27d8babff22121cccdc4cb1226ca6fc7d2e8167e`. B2 plus passive review
bookkeeping `2afb7fcd8b160d435de5257150f0727b9582fa21` were fast-forwarded
and pushed to main; the actual remote ref matched. Bookkeeping assessment was
passive, 34 authored lines, review not due.

Native assessment from `19e0b45`: medium, 4 paths/790 lines. The user granted
review; the provider reliability reviewer inspected all four immutable patches.
It approved the candidate with non-blocking advisory R3-001: integer delta
subtraction can exceed safe minor units when individually safe totals have
opposite signs. The reviewer did not run tests. Exact acknowledgement succeeded:
`review-b3c705576009af2b`, target
`sha256:19c46b95a340368622884818bfa37c934da1a51639384b30b09a5f1faf0740c5`,
authority burned. No correction transition exists; this review is closed.

B2 delivery is complete. Address R3-001 as separate B2a
before UI wiring, using observed RED/GREEN. Arithmetic guard is within approved
comparison correctness scope, not a change to financial meaning. Retain
fractional mean deltas and valid integer results; match existing out-of-range
amount policy, not silent rounding. Strict TDD remains enabled by AGENTS.
B2a focused runner: installed Vitest on `budget-period-comparison.test.ts` and
`budgets.test.ts`; full UI/domain, three TypeScript projects, Oxlint and
whitespace at closure. Runtime browser is N/A for this pure arithmetic boundary.

## B2a verification and next step

Integer current/reference deltas now use the existing `safeAdd` guard; fractional
historical means keep their fractional arithmetic path. Ordinary signs, null/zero
baselines and percentages are unchanged. Rollback: comparison model and its test.
Source/test delta: 47 authored lines in two files.

Strict-TDD RED: two unsafe-direction regressions failed before the source edit.
Final checks: focused 50/50 (parent repeated), full UI/domain 397/397, TypeScript
node/app/browser, Oxlint with zero warnings/errors and whitespace all passed.
Boundary regressions cover both unsafe directions, both valid safe-integer
boundaries, and unchanged fractional expense/income means.
Evidence: `/tmp/b2a-CvLmBW/` (`focused-red.log`, `focused-green.log`,
`ui-full.log`, `tsc-*.log`, `oxlint.log`, `diff-check.log`); parent repeat:
`/tmp/b2ap-Idflo2/`. No browser/runtime boundary for this pure arithmetic task;
full Node suite and build intentionally not run. No changes to B3/UI yet.

B2a commit `6f00017d92ea4d1822fadc882bc96fec35898cce` was fast-forwarded
and pushed to main; the actual remote ref matched. Assessment from `2afb7fc`:
medium, 3 paths/81 lines, `review_due:false`, `under_budget`. No new native
approval is claimed; the pending slice keeps reviewed boundary `2afb7fc`.
The B2 approval remains closed. Next: B3 controls and compact row wiring.

## B3 in progress

Connect the already verified comparison model to the page with default previous
period, multiple explicit references and one primary reference. Show current /
budget plus primary reference and mean at a glance on desktop AND mobile;
additional deltas/periods/provenance stay in Details. For an incomplete current
period, clearly separate the detailed same-elapsed-days comparison from the
visible full-reference totals and the full-period mean. Never cap or alter the
existing current budget totals to create that pacing detail. Reuse scoped data
and add minimal domain support/tests only if needed. Keep existing transactions,
calendar semantics, filtered-cut labels and native finance calculations intact.
Use one panel-level reference/mean date/unit/count explanation. Scope income
separately and clearly. Avoid thousands of generated select options or duplicate
historical scans when selecting references. Preserve empty/missing/zero states.

Delegated direct: hook, page model, controls, row presentation and tests require
coordinated edits. Strict TDD from AGENTS; runner installed Vitest for existing
Budgets page/helper/table tests plus focused new controls/hook/helper tests.
At closure run full UI/domain, all three TypeScript projects, Oxlint and whitespace;
parent repeats focused check and delegates source-only browser/visual validation
including desktop/390/320 and intermediate sidebar/indentation widths. No browser
or budget private input, localhost:5173, installation or deployment is allowed.
B3 forecast roughly 800–1,100 authored lines including tests; a cohesive clear UI
integration may exceed the heuristic, no PR is being created. B4 remains pending
for durable comparison browser regressions and final integration verification.
Engram mirror remains prohibited pending runtime registration.

### B3 first integration check — correction required

Writer implementation passed focused 53/53 (parent repeated), full synthetic
UI/domain 406/406, all three TypeScript projects, Oxlint and whitespace. TDD
RED evidence: `/tmp/b3-WBGMAP/{elapsed-red,page-red,controls-red}.log`;
final writer logs: `*-final3.log`; parent repeat: `/tmp/b3p-nvP1DD/`.

Independent browser proof is partial, not acceptance: 12/15 durable cases passed;
the utilization block overlaps the current/assigned label and intercepts ordinary
consumption-button clicks at 1280/390/320px. All nine detached perspective/viewport
probes retain that blocker. Correct the layout root cause without forced clicks,
pointer-event masking or hidden content; add durable non-overlap/pointer proof.
Then rerun functional checks and isolated browser/visual acceptance on final bytes.

Other synthetic-history behavior passed: reference selection/reset/persistence,
zero-inclusive mean, missing versus zero, separate income, elapsed versus full
totals, exact dialog posting IDs with keyboard activation, focus return, no page
errors and horizontal containment at intermediate widths. Existing row-height
measurements are invalid compactness proof while text overlaps. Parent inspected
desktop/mobile screenshots and confirmed the overlap. Evidence:
`/tmp/b3v-yvc1gaj_/` (logs, measurements, screenshots and preservation report).
No source, index, protected user files or HEAD changed during verification.

### B3 final verification

The comparison integration is verified on corrected bytes. Reference selection
supports add/remove/one primary, defaults to the preceding compatible period,
resets for budget/target changes and persists across perspectives. Current/budget,
full primary reference and mean stay visible; secondary deltas and separately
scoped same-elapsed figures remain in Details. Income has its own scoped summary.
Current budget financial totals and transaction inspection are unchanged.

Overlap root cause: legacy grid-area declarations also applied to nested children
of the new current block, creating implicit overlapping tracks. Grid areas now
apply only to direct legacy summary children; equal narrow-screen columns retain
space for long names. No pointer-event masking, forced click, clipping or reduced
font size was used. New durable non-overlap/center-hit/ordinary-click assertions
failed 3/3 before the correction, then passed. RED:
`/tmp/b3correct-red2.log`; final writer checks: `/tmp/b3correct-*-final2.log`.

Final proof:
- Focused tests 53/53 (parent repeated on final bytes); full UI/domain 406/406.
- TypeScript node/app/browser, Oxlint zero warnings/errors and whitespace passed.
- Final writer durable budget browser 15/15 and synthetic-history probe 9/9.
- Independent fresh-source browser 15/15 and probe 9/9, all three perspectives
  at 1280/390/320px plus 768/900/1024 containment. No page errors or external
  requests. Ordinary pointer and keyboard dialogs return exact posting IDs and
  restore focus; controls >=44x44px. Current/reference/mean, covered zero versus
  missing history, separate income, elapsed/full distinction, reference resets
  and persistence, Details/tree independence all passed.
- Parent inspected corrected desktop/390/320 images; the independent verifier
  also inspected 900px. Meter/button and label/meter intersections are zero.

Real parent/child closed heights: 87.91/87.91px desktop, 180.20/180.20px at390,
180.20/195.11px at320, 131.41/131.41px at intermediate widths. The 320px child's
utilization label wraps naturally; preserve readable text rather than force the
185px advisory target. DOM-only extreme-name/billion-value stress stays contained
but grows much taller; this is layout proof, not financial proof.

Parent repeat: `/tmp/b3p2-pNV5fq/`. Independent evidence/screenshots/measurements:
`/tmp/b3f-vd0_j4mt/`; fresh557-file manifest SHA256:
`e41080980c3ef9e4f8c87aa659455a8dea6ef78b78233dc954eb09db2eceff25`.
All17 candidate paths matched the staged index; source, protected dirty files,
HEAD and index bytes/modes stayed unchanged during verification. Synthetic only;
no private input, workspace build/full Node suite or manual screen-reader audit.

Rollback: the B3 comparison integration and its tests (17 source/test/browser
paths), retaining B1/B2/B2a. Source/tests1125 authored lines form one cohesive
page integration with financial/interaction regressions; no PR is being created
and tests were not trimmed to meet the advisory heuristic. Native assessment,
candidate-specific review when due, commit evidence and main delivery follow.
B4 remains pending for durable richer multi-period browser regressions and final
integration closure. Engram mirror is still prohibited pending registration.

### B3 review and delivery handoff

B3 commit: `47907bf1ef33b9d4c757df42961f3249156e77ca` (18 paths, 1235
authored lines including this record). Index and committed trees matched:
`de713feb066d835acac2323ddf7bc7e456d31031`; no commit-hook source mutation.
Assessment from `2afb7fc` included pending B2a: medium, 18 paths/1312 lines,
review due at the slice budget. The user explicitly granted this candidate.
Native reliability review inspected all 18 immutable patches; it did not run
tests. Exact acknowledgement succeeded for `review-8a7489d51b376a09`, target
`sha256:cd4a9d2549c4c707e405f052e51803a863a6b1bdbfdf2f13e9623180be1926cb`:
authority burned. The transaction is closed and must not be resumed or reused.

Non-blocking advisory R3-001: comparison arithmetic rejection currently escapes
from the page hook instead of leaving the usable current-budget model and a
comparison error state. Address this as separate B3a after B3 delivery. Catch
only the comparison boundary, keep current financial analysis unchanged, use
neutral existing UI error copy, and add a real throwing-history hook regression.
Strict TDD enabled by AGENTS; installed Vitest hook/page/domain focused tests,
full UI/domain, three TypeScript projects, Oxlint and whitespace. Delegated
direct: hook and behavioral test require coordinated edits; forecast 50–120
authored lines. Parent repeats a focused command; no new private-data access.

B4 follows B3a: retain durable richer synthetic-history browser tests for reference
controls, zero/missing history, mean and income, perspectives and responsive
interaction; source-only snapshot final verification. No broader product scope.

B3 and bookkeeping `a37eabc9a2de19297ecd37995edb30aa5367e854` were
fast-forwarded and pushed to main; the actual remote ref matched. Bookkeeping
assessment: passive, 38 lines, review not due. Returned to the feature branch;
the three protected user edits remain untouched. B3a implementation follows.

### B3a verification

The hook now catches only the comparison invocation. Rejected historical
arithmetic leaves the safe current analysis and inspection controls usable,
exposes a neutral comparison error and recovers when filters remove the unsafe
history. Returned unsupported reasons remain distinct; no technical detail leaks
into the existing UI message. Current financial analysis and layout are unchanged.

Strict TDD: actual domain/base-model history triggered a render failure before
the source fix (1 failed, 2 passed), `/tmp/b3a-red.log`. Final focused35/35
(parent repeated), full409/409, TypeScript node/app/browser, Oxlint zero
warnings/errors and whitespace all passed. Writer: `/tmp/b3a-*-final2.log`;
parent repeat: `/tmp/b3ap-1LYNsP/`. No browser rerun for this isolated hook error
boundary; existing browser behavior receives final B4 integration checks.

Rollback: hook plus hook/page tests, three source/test paths,124 authored lines.
The real-history regression and visible error/recovery assertions belong with
the guard; no financial/domain policy changes or private-data access. B3 native
approval remains closed. Commit/assessment/main delivery are parent-owned.

### B4 next task

Capture the already verified richer synthetic-history flow in durable browser
tests: multiple references and one primary, missing versus covered zero,
zero-inclusive mean and separately scoped income, perspective persistence,
target/budget resets, visible mobile metrics and independent transaction/details
actions. Keep synthetic fixtures isolated from existing test oracles, freeze time
where needed, and preserve all current financial behavior. Delegated direct:
fixture/probe mapping and durable browser tests require coordinated reading and
writing. Forecast200–350 authored lines (advisory); no artificial split/codegolf.
Use source-only isolated harness, existing dependencies, sanitized environment,
all1280/390/320viewports and Real/Yo/Deudas. Existing behavior may start GREEN;
do not invent RED or break production solely to manufacture test evidence.
