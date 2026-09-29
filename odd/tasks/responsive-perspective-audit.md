# Audit interface readability across perspectives and devices

## Objective and authorization

Review the nine screens and shared controls in Real, Yo and Deudas on desktop
and mobile. Fix only reproducible, understood functional or visual defects;
preserve existing design and financial semantics. The user explicitly requests
confident fixes, integration and push to main without further questions.

Use synthetic local data only. No live backup, `.env`, sync, deployment or
unrelated remote access. Remote scope is Git push to the established origin
`git@github.com:thexenons/myexpenses-analysis.git` via existing Git SSH transport.
Preserve unrelated dirty `.atl` registry files and `odd/tasks/pcloud-cli-env.md`.

## Workflow

- Base: `2c87e7585844f84b689787bc06b1bbd78ef483bb`.
  Branch: `fix/responsive-perspective-audit`.
- Delegated direct: mapping spans more than four files. Separate bounded workers
  cover rendered matrix, financial presentation semantics and shared responsive
  controls. Delegate non-trivial multi-file fixes after reproducing findings.
- TDD on from the explicit session choice: regression RED, implementation GREEN,
  then refactor only if necessary. Existing runners: `pnpm exec vitest run`,
  `pnpm test:node`, and `pnpm test:browser` (isolated synthetic browser harness).
- Native RDD stays on (global). Assess each committed work unit from its prior
  reviewed boundary; preserve native risk selection, consent and transitions.
- Delivery: direct main, no PRs, following the explicit no-questions instruction
  and previously accepted size exception. Keep independently reviewable work
  units; updated forecast approximately 550 authored lines from the five verified
  findings and their regression tests. The initial 350-line forecast was provisional.
  Do not shrink tests or formatting to satisfy a size forecast.
- Engram mirror `odd/responsive-perspective-audit/tasks` is pending: the host
  prohibits agent-attributed memory calls until runtime registration is restored.

## Tasks and acceptance

- [x] T1 — Audit and record reproducible findings and coverage.
  - Delegated mapping: `interface_matrix_audit`, `interface_semantics_audit`,
    `responsive_component_audit`; no production edits during exploration.
  - Nine routes × three perspectives at desktop and mobile; inspect screenshots
    as well as DOM bounds, navigation, filters, expandable sections and drawers.
  - Exercise narrow mobile, negative/zero/large amounts, long labels and empty
    states where fixtures permit. Separate verified defects from design opinions.
  - Record exact coverage, evidence, limitations and bounded fixes below.
- [x] T2 — Correct monetary, exact-date and status presentation.
  - Delegated writer: `interface_semantics_audit`; several non-trivial files and
    their tests require delegation. Observed RED/GREEN with existing Vitest runner.
  - Suppress negative zero in all three currency formatters, including budget
    currencies/precision; preserve actual negative rounded amounts and raw values.
  - Exact chart tables retain original period identity when formatting shortens
    it; preserve CSV, row IDs and drilldown callbacks.
  - Translate normalized reconciliation status in budget contribution detail;
    preserve the current status choice, amounts and source-data contract.
  - Rollback: these presentation changes and their regression assertions only.
- [ ] T3 — Keep mobile filter actions and chart amounts visible.
  - Delegated writer: `responsive_component_audit`; shared geometry/CSS plus
    tests are multiple non-trivial files. Verify failing bounds before the fix.
  - Long selected-category chips wrap inside the filter sheet and retain an
    accessible visible remove control at 320/390 widths. Long root-category
    choices also wrap inside their desktop grid cell without covering neighbors.
  - Reserve enough SVG space for formatted signed numeric labels in series and
    horizontal-bar charts; never drop leading digits or signs to fit margins.
  - Re-run rendered matrix and stress cases, standard isolated browser tests,
    full Node/UI, types, lint and diff checks. Inspect screenshots after the fix.
  - Rollback: chart layout/filter-chip styles and matching regressions only.
  - Commit work units and follow native review; integrate/push main as requested.

## Evidence and progress

- CodeGraph root/index verified and current before structural exploration.
- T1 commit `5357d1e`: 100 authored documentation lines; native assessment passive,
  not due (`non_executable_only`). Next reviewed boundary is `5357d1e`.
- Previous budget/copy fix is already on main and origin/main at the base above.
- Baseline rendered matrix: 81 route/mode/width combinations passed in nine
  Chromium tests, 50.9 seconds (1440, 390 and 320 widths). Exact financial checks
  unchanged; no page errors, outbound requests or document-wide overflow.
  Screenshots: `/tmp/myexpenses-browser-source-yNBSLH/source/node_modules/.tmp/playwright-results`.
- Stress rendering covered the same 81 combinations with large signed amounts,
  long labels and expanded sections. Parent inspected the mobile filter drawer
  and desktop category screenshots: removal action beyond the sheet edge, and
  20,000,000 EUR axis text losing leading digits. Horizontal-bar values also clip.
  Evidence: `/tmp/myexpenses-browser-source-MVUVvS/source/node_modules/.tmp/playwright-results`.
  Completed stress functional pass: 3/3 tests, 81 expanded route/mode/width
  combinations, 43.7 seconds, including keyboard drawer/focus restoration and
  empty results. The earlier temporary test misused native search Escape (which
  clears that input) and expected the wrong stable empty-state copy; corrected
  only the diagnostic. Log: `/tmp/myexpenses-ui-stress-audit/run-final.log`.
- Numerical audit: 407 synthetic assertions across 11 fixtures and three modes;
  42 debt/comparison/category-average tests passed. Empty, zero, cancelling,
  refund-only, large and VOID-only cases preserve documented financial contracts.
- Two temporary rendered regressions confirm negative monetary zero and duplicate
  daily labels for 2024-01-01 and 2025-01-01. `signDisplay: negative` is supported
  by the installed TypeScript and Chromium and preserves real negative cents.
  Evidence: `/tmp/myexpenses-interface-semantics/`.
- Budget detail visibly exposes raw RECONCILED instead of a localized status.
  Source inspection found native keyboard/focus/reduced-motion support elsewhere.
  Intentional horizontal table scrolling and offscreen content-visibility capture
  gaps are not defects. Value-date tie sorting lacks a stronger documented rule;
  no speculative sorting or accounting changes will be made.
- Extra drawer reproduction: a long root-category label overlaps its neighboring
  desktop checkbox. Include it in T3's same wrapping correction and bounds test.
- T2/T3 bounded writers are implementing the accepted findings. Emulation is not
  a claim of testing every physical device, browser engine, data set or assistive
  technology.
- T2 completed: three currency formatter options, exact chart-table period labels
  and translated normalized budget status; source values, CSV and callbacks are
  unchanged. Eight files, 136 additions/23 deletions (159 authored lines).
  RED: seven expected failures/ten passes; GREEN: 17/17 focused tests, plus 16
  related tests. Logs `/tmp/interface-t2-{red,green,related}.log`.
- T2 work-unit commit `b96015a`: 195 authored lines including evidence; native
  medium assessment `under_budget`. Pending reviewed boundary remains `5357d1e`.
- Parent full verification with both writers' stable source: Node 281 passed,
  three optional-private-data skips; UI 335/335 in 82 files. Type-check, lint and
  diff check passed. Logs `/tmp/interface-audit-{node,ui,types,lint}.log`.
- T3 final source: 184 additions/11 deletions in ten files. Numeric labels reserve
  conservative space from their formatted text; categorical labels respect the
  available column and keep full names in exact tables/inspectors. Tick selection
  avoids text overlap; long filter choices/chips wrap and keep removal visible.
- T3 RED: six initial geometry failures plus one long-name regression exposed
  by the first post-fix browser pass; GREEN: 45 focused tests in nine files. The
  extra category-name fix stays in the same bounded chart layout correction.
  Logs: `/tmp/responsive-chart-{red,label-red,focused,types,lint}.log`.
- Final parent checks after the last source edit: 336/336 UI tests, 281 Node
  passes/three optional-private-data skips; types, lint and diff check passed.
  Logs: `/tmp/interface-audit-{node,ui,types,lint}-final.log`.
- Final rendered numeric matrix passed all 81 cases (nine tests, 49.5 seconds).
  Stress pass: all 81 cases (three tests, 1.2 minutes), with actual SVG glyph
  containment, tick-overlap checks, visible chip removal, keyboard/focus and empty
  results. Parent inspected corrected mobile drawer and desktop category charts.
  Logs: `/tmp/myexpenses-ui-{matrix,stress}-audit/run-verified.log`; snapshots
  `/tmp/myexpenses-browser-source-gIWFg6` and `/tmp/myexpenses-browser-source-a1Jak1`.
- The 320px filter-label diagnostic is intentional visually-hidden text with a
  complete accessible button name and visible icon/count, not lost UI content.
  Standard isolated browser suite is still running; do not claim its result yet.

## Next step

Finish the standard browser suite and native committed-candidate review, then
record final evidence and deliver to main. Keep uncertain findings unchanged.
