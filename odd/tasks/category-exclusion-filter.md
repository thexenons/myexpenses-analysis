# Include or exclude selected categories

## Objective
Allow category filtering either by selected paths or by all paths except those
selected, as explicitly confirmed by the user. Implement locally; new remote
publication is not assumed from feature implementation alone.

## Scope and decisions
- Add categoryMode include/exclude, default include for legacy preferences.
- Negate the existing combined category predicate in exclude mode, including
  linked counterparts only when the existing either option is selected.
- Existing subtree/exact depth applies identically; no selected path means no
  category restriction regardless of mode. Uncategorised rows remain unless an
  explicitly matching selection excludes them.
- Persist and restore mode; missing/invalid mode safely defaults to include.
- Applied chips clearly indicate exclusions. Category chart drilldown explicitly
  includes the clicked category, never inherits an inverse exclusion.
- Preserve unrelated staged .atl registry files. No private input, dependencies,
  production deployment or data changes. Existing Spanish UI remains neutral.

## Tasks
- [x] C01 — Implement central category semantics, persistence, drawer controls,
  explicit applied-filter labels and inclusive category drilldown with regression
  tests. Route: delegated writer; multiple non-trivial files and source reading.
  Test-first deterministic RED/GREEN, including empty/multiple selections,
  subtree/exact, counterpart, legacy restore and persistence.
- [x] C02 — Independently verify semantics and synthetic browser workflow at
  desktop/mobile/narrow widths; review final diff and delivery status.

## Checks and delivery
Focused domain/UI tests, full Node/UI suites, lint and project types, synthetic
browser persistence/filter/category scenarios and synthetic deployment.
Normalize before final verification. Native RDD is on; assess work-unit commits
against the feature branch point, obey scoped consent and exact transitions.
Conventional commits on feature branch; no unrelated staged files. Delivery
strategy auto-chain, prior user preference stacked-to-main retained; forecast
250–450 authored lines (advisory only), no PR or new remote write assumed.

## Progress
C01/C02 implementation and verification complete; local work-unit commit and
native committed-only assessment follow. Main is unchanged pending explicit
new remote delivery authorization.

## Verification evidence
- Domain RED: 31 pass / 3 fail / 1 reference skip; GREEN 34 pass / 1 skip.
  UI/hook RED 82 pass / 6 fail; final focused GREEN 89 pass.
- Writer full Node 343 pass / 3 reference-input skips, UI 508 pass / 91 files;
  lint, project types, synthetic deployment 1 pass and diff checks pass.
- Independent positive-selected synthetic domain 3 pass; five focused UI/store/
  hook files 89 pass; lint/type/diff pass. Parent repeated the three synthetic
  cases successfully. Normalization preceded final checks; source stayed stable.
- Isolated synthetic browser/build 30 pass, zero fail/skip in 2.7 minutes,
  desktop 1280, mobile 390 and narrow 320. Full persistence spec plus category
  composition, advanced filters and nine-route axe/overflow/navigation checks.
  Inclusion selects Food; exclusion retains baseline minus Food; mode survives
  reload, search composes and empty exclusion leaves rows unrestricted.
- Browser proof asserts row membership/counts, not separate monetary KPI
  complement. Inclusive chart drilldown has unit proof, not a separate browser
  exclusion scenario. Physical devices/screen readers are not claimed.

## Test safety exception
The existing reference test reads/normalizes local data/app-dataset.json before
its hash-mismatch skip. Independent unfiltered and attempted negative-lookahead
commands entered that body; no contents or derived values were printed, uploaded
or modified. Stopped that path. Subsequent positive name selection executed only
three new synthetic cases. Full Node results are not claimed synthetic-only.

## Outcome
categoryMode include/exclude defaults/restores safely; nonempty exclusion negates
combined configured posting/counterpart match, exact/subtree preserved. No paths
means no restriction. Explicit exclusion chips and labeled drawer mode; shared
hook dependencies forward mode; category chart drilldown resets inclusion.
No dependencies/data/schema/production changes. Unrelated registry files remain
staged and excluded. Rollback: remove this filter mode and its tests/docs together.

