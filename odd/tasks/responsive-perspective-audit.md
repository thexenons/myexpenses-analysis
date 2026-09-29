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
- [ ] T2 — Correct monetary, exact-date and status presentation.
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
    accessible visible remove control at 320/390 widths.
  - Reserve enough SVG space for formatted signed numeric labels in series and
    horizontal-bar charts; never drop leading digits or signs to fit margins.
  - Re-run rendered matrix and stress cases, standard isolated browser tests,
    full Node/UI, types, lint and diff checks. Inspect screenshots after the fix.
  - Rollback: chart layout/filter-chip styles and matching regressions only.
  - Commit work units and follow native review; integrate/push main as requested.

## Evidence and progress

- CodeGraph root/index verified and current before structural exploration.
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
  A 320px empty-search diagnostic using Escape needs harness clarification;
  do not claim that auxiliary stress suite passed in full yet.
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
- No production edits yet. Emulation is not a claim of testing every physical
  device, browser engine, data set or assistive technology.

## Next step

Implement T2 and T3 with regressions; repeat rendered verification against the
final source. Keep uncertain findings unchanged and report actual coverage.
