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
- [ ] B2 — Add a budget-scoped reference/mean model with synthetic regressions
  for period boundaries, available history, zero activity, refunds, VOID, each
  perspective, scope/currency, hierarchy and separate income totals.
- [ ] B3 — Connect reference controls and mean context to the page and compact
  rows. Keep primary reference and mean visible on mobile; show one relevant
  textual comparison signal and disclose additional periods/deltas/provenance.
  Verify reference changes, empty states, period changes and transaction access.
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
- Last acknowledged native review boundary: `a9446eb` (B1 and the preceding CSV
  slice). RDD is on (global); assess each work-unit commit and follow exact native
  transitions/consent when due. Never invent PASS.
- Delivery strategy: `auto-chain`, `stacked-to-main`; B1, B2, B3 and B4 are the
  planned delivery boundaries. Forecast roughly 1,400–2,000 authored lines across
  all tasks including tests/docs, not a hard task limit. Keep cohesive changes;
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

B1 is ready for authorized main integration/push. Next: deliver B1, then B2.
Engram mirror remains prohibited pending runtime registration.
