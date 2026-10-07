# Compact mobile toolbar

## Objective and authorization
User approved a two-row mobile toolbar: period controls together, compact granularity dropdown next to perspective and filters. Preserve desktop, active chips, touch usability, and custom date ranges. On 2026-10-07, the user explicitly authorized commit and push to main after task closure. No separate deployment, private data, or dependency changes authorized.

## Scope and approach
GlobalFilters mobile layout, compact GranularityControl, narrow PeriodSelector wrapping, and focused UI/browser regressions. Existing Spanish UI remains Spanish. Single delegated writer; multi-file logic and preparation trigger delegation. Forecast: approximately 200–300 authored changed lines; delivery strategy ask-on-risk. No commits without explicit authorization under project policy.

## Tasks
- [x] M01: Observe regression RED, implement compact mobile controls and layout (delegated).
- [x] M02: Verify UI behavior, typecheck, lint, and isolated mobile/desktop browser geometry (delegated).
- [x] M03: Inspect final diff and follow enabled native review consent; report remaining checks (parent).

## Acceptance criteria
- Default month toolbar uses two control rows at 320px and 390px without overflow or overlapping targets.
- Period mode/value share a row when practical; custom ranges remain usable.
- Granularity options retain their behavior and accessible label.
- Desktop segmented control and layout remain unchanged.
- Active chips and comparison disclosure remain functional.

## Verification
Focused GlobalFilters/GranularityControl UI tests; pnpm type-check; pnpm lint; isolated financial-explainability browser tests with synthetic fixtures only; git diff --check. Native review mode on; user granted this candidate's review on 2026-10-07.

## Progress
2026-10-06: Implemented mobile two-row layout and responsive native granularity select. Default period stays inline; custom mode expands to keep its label and date fields readable. Desktop segmented control preserved. No commits made.

Observed RED: 3 focused UI regressions failed before implementation; missing dropdown browser checks failed at both mobile widths. GREEN: 30 focused UI tests and 21 isolated browser regressions passed. Type-check, lint, and diff check passed; type-check/lint repeated after removal of diagnostic logging/screenshots. Full browser suite not run.

Synthetic fixture measurements at 320px and 390px: toolbar including unchanged active chips decreased from 262.92px to 169.36px (~93.56px); desktop 166.95px unchanged. Parent inspected mobile month/custom screenshots and source diff. Browser tests cover layout, ranges, focus, chips, drawer, comparison and responsive state continuity. Existing stale keyboard expectation corrected to include the current-month button; select readability checks now measure selected option rather than longest unused label.

Native assessment initially required explicit untracked inventory selection. The tracking document was excluded from the code candidate; native START classified the seven code/test files (242 authored lines) as medium risk. User granted review on 2026-10-07. One consolidated reliability review found no candidate-caused defects; no corrections required. Exact acknowledgement completed with authority burned for lineage `review-76fe6729d37e7002`, target `sha256:f19e090eac0604bf66495543f49d3412862836ef0665eb320796d1c20780439b`. Review inspected immutable patches; it did not rerun functional tests. Parent final `git diff --check` passed.

## Next step
Implementation and review complete; no remaining in-scope development tasks. Commit and push to main explicitly authorized on 2026-10-07. Full browser suite remains unrun; focused checks are recorded above. Production acceptance is not claimed.

## Delivery unit
One behavior unit includes the seven reviewed source/test files and this tracking document. Rollback boundary: revert the compact toolbar layout, responsive granularity presentation, and associated tests together; no data or dependency migration is involved. The delivery commit is discoverable with `git log -1 --format=%H -- odd/tasks/compact-mobile-toolbar.md`.
