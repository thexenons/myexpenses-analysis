# Conventional combined filter facets

## Objective and authorization
Extend the existing global filters with the missing practical dimensions so users can combine precise criteria without a rule builder. The user explicitly selected conventional filtering rather than arbitrary nested AND/OR/NOT rules. Preserve the current financial calculations, filtered posting subject, and privacy boundaries. Prior authorization covers work-unit commits, integration and push to main with a clean worktree; no production access or deployment is authorized.

## Scope and accepted semantics
- AND between active dimensions; OR among selections within a multi-select dimension. Existing scope, dates/date basis, account/directional account, category depth/counterparty, status, tags, linked and global text filters continue working together.
- Add exact payee and payment-method identity selections, with explicit missing-value options; movement category type (expense, income, transfer, neutral); posting currency; inclusive minimum/maximum absolute amount in base EUR; separate comment and reference text.
- Amount compares integer `Math.abs(posting.amountEurMinor)`. The current dataset/base currency is EUR with two decimal places; never compare raw native amounts across currencies. Clearly label EUR and absolute magnitude, preserve zero bounds, and reject invalid/reversed ranges without silently applying a different filter.
- Identity keys distinguish source IDs, legacy labels and missing values without collisions. Evaluate payee/method on the posting itself, consistent with current Insights grouping; do not add split-parent fallback or change normalization/financial attribution. Comment matching includes the posting and split-parent comment like existing search; reference matching is posting-only. Text uses existing case/diacritic/token conventions.
- Patterns payee and payment-method drilldowns use the same identity keys as filtering. Keep source IDs distinct even when labels match. Preserve all other active filters when selecting a dimension and navigating to movements.
- Derive available options from the full in-memory dataset, not only currently filtered results, so active selections remain clearable. Maintain chips, counts, reset/defaults, snapshots/restore, deferred calculations and keyboard/mobile accessibility.
- No saved views, URL serialization of financial filters, nested boolean builder, new dependencies, private-data inspection or unrelated redesign. Local persistence remains granularity-only; locking clears financial selections.
- Extend the existing Spanish UI with neutral professional copy; code, tests and this document use English.

## Workflow and delivery
- Base: `main` at `5271f1caf97d40f1ba73649f4163ca6555acaed9`; branch: `feat/combined-filter-facets`.
- Route: delegated direct, one writer at a time. Each task spans multiple non-trivial files and preparatory reading; existing exploration mapped domain, UI, store, Insights and tests.
- Strict TDD: enabled by AGENTS.md. Observe RED before implementation, GREEN and REFACTOR using Vitest for source/UI tests and Node/tsx for scripts/domain tests.
- Forecast: approximately 1,000–1,600 authored changed lines across coherent work units; roughly 400 per task is advisory, never grounds to omit tests or compress code. Delivery strategy: ask-on-risk; retain the session's selected feature-branch-chain ("Acumulados") and accumulate work units before final main integration. No PR creation requested.
- RDD: on (global); initial review boundary is the base above. Assess each committed work unit, follow native due transitions and fresh candidate consent; earlier grants/reviews are not reusable.
- Verification uses synthetic source-only snapshots for broad Node/build checks, with external HOME/TMPDIR and sanitized environment. Never inspect/copy real data/, public/, backups, .env, vaults, credentials or private logs. Browser checks use the existing isolated launcher and external Chromium/runtime cache, no downloads or global installs.
- Engram mirror: pending; mutation calls currently fail `unknown_session` despite omitted session_id. Preserve this local document as recovery authority.

## Tasks
- [x] T1: Extend typed facet evaluation and state propagation.
  - Route: delegated; domain types/defaults/validation/snapshot/matcher, shared exact identity helpers, deferred hook projection and regression tests.
  - Verify every dimension alone and combined with existing filters; empty/missing/legacy/duplicate-label identities; neutral versus bucket classification; native currency versus base-EUR magnitude; zero/inclusive bounds; comment-parent and reference-only semantics; invalid state; reset and non-persistence.
  - Checks: focused Node/domain filter suite, filtered analytics/store Vitest, relevant TypeScript configurations, lint and diff check. Preserve all previous tests.
- [ ] T2: Expose conventional facets in the existing filter drawer.
  - Route: delegated; grouped checkbox/text/amount controls, reusable presentation helpers where needed, chips/count/reset and UI tests.
  - Keep large option lists searchable/scrollable using existing patterns where practical; label missing/duplicate values honestly. Validate two-decimal amount input and reversed bounds visibly, including intermediate editing and clearing. Avoid new persistence or a rule-builder UI.
  - Checks: drawer/global-filter/hook/store Vitest, accessibility and keyboard tests, app TypeScript, lint/diff check.
- [ ] T3: Add precise Patterns drilldowns and integration proof.
  - Route: delegated; shared identity grouping for payees/methods, Patterns callbacks and interaction tests, synthetic real-browser fixtures/tests and relevant user documentation.
  - Select exact payee/method rows without dropping other filter dimensions; ensure displayed counts and selected postings agree for duplicate labels/missing values and legacy data. Preserve existing financial aggregation.
  - Checks: Insights/domain regressions, full safe-snapshot UI/Node/architecture/TypeScript/lint/synthetic deployment, isolated Chromium combined filters/drilldown/chip/reset/privacy/overflow at desktop/mobile widths.

## Acceptance and rollback
Users can combine all old and new facets with predictable AND/OR semantics, inspect and remove active criteria, reset them, and drill down from Patterns without changing unrelated filters or exposing their contents in localStorage/URLs. Existing budget, category-average, comparison and monetary results change only as a consequence of the selected postings. No live deployment, physical-device, Safari or Firefox proof is implied by Chromium emulation.

Rollback coherent units in reverse: Patterns integration/tests, drawer/chips controls, then optional domain facets and hook propagation. Keep each task's tests and documentation with its behavior. Record concrete commits, observed results and any failed/skipped checks below.

## Verification commands
Use the installed Node 24 binary and direct entrypoints, with safe snapshots where noted:
- `node node_modules/tsx/dist/cli.mjs --test tests/domain/<focused-filter-suite>.test.ts`
- `node node_modules/vitest/vitest.mjs run <focused-source-tests>`
- `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit` (and app/browser configurations)
- `node node_modules/oxlint/bin/oxlint --jsx-a11y-plugin --vitest-plugin --deny-warnings`
- Full Node/domain/architecture and deployment checks only in a source-only snapshot; never the private-fixture-bearing worktree.
- `node node_modules/tsx/dist/cli.mjs tests/browser/run-isolated.ts` with previously installed external Chromium/runtime cache.
- `git diff --check`

## Progress and next step
T1 behavior and checks observed; work-unit commit and native assessment remain with the parent orchestrator. T2 and T3 remain pending. The user additionally authorized a comprehensive research-led UI audit and implementation; preserve this feature's scope and reconcile its forthcoming drawer/Patterns work with the shared UI improvements rather than implementing competing components.

T1 RED: `tests/domain/filter-facets.test.ts` initially failed because the exact-identity module did not exist. A separate store regression failed because `lock()` retained in-memory `search`, payee selection and amount bound. GREEN/REFACTOR: the new isolated domain suite passes; `lock()` now resets all financial criteria to the default real-cash-flow scope, retaining only the independently persisted granularity preference. Existing account reconciliation is unchanged.

T1 source: `src/domain/analytics/{types,filters,identity-keys}.ts`, `src/presentation/hooks/filtered-analytics/filtered-analytics.hooks.ts`, `src/application/store/app-store/app-store.ts`; tests: `tests/domain/filter-facets.test.ts`, the filtered-analytics hook test and app-store test. The full analytics suite's optional private golden is intentionally unavailable in the source-only snapshot. No T1 runtime DOM boundary was added; the relevant hook/store boundary is covered by Vitest. Rollback boundary: remove the optional facets, identity helpers, matcher and hook projections, lock reset and their focused tests without altering financial aggregations.

T1 final source-only snapshot `/tmp/myexpenses-filter-t1-source-EYdqnh`, with only allowlisted tracked `src/`, `scripts/`, `tests/` and build configuration plus the two new source/test files (no `data/`, `public/` or secrets):
- `node node_modules/tsx/dist/cli.mjs --test tests/domain/analytics.test.ts tests/domain/filter-facets.test.ts`: 16 passed, 1 private golden skipped, 0 failed.
- `node node_modules/vitest/vitest.mjs run src/presentation/hooks/filtered-analytics/filtered-analytics.hooks.test.tsx src/application/store/app-store/app-store.test.ts`: 18 passed, 0 failed.
- `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit` and `-p tsconfig.app.json --noEmit`: both passed.
- `node node_modules/oxlint/bin/oxlint --jsx-a11y-plugin --vitest-plugin --deny-warnings src scripts tests`: 0 warnings, 0 errors. Explicit source roots avoid following the snapshot's linked `node_modules`.
- `git diff --check`: passed in the worktree.

Independent T1 verification: `/tmp/myexpenses-filter-t1-independent-th8rbneb/source` retained the original `.gitignore` and a real `node_modules` with package-directory links, correcting the writer snapshot's root dependency symlink. All 514 safe source/config inputs matched repository bytes before and after checks. Domain suites again passed 16 tests with 1 unavailable private golden skipped; hooks/store Vitest passed 18 tests. The exact unqualified root command `node node_modules/oxlint/bin/oxlint --jsx-a11y-plugin --vitest-plugin --deny-warnings` passed across 454 files with zero warnings/errors; `git diff --check` passed. No material introduced defect was found. Use this corrected snapshot structure for later work instead of narrowing lint coverage. The new domain combined case covers statuses with new facets; T3 still owes comprehensive mixed old/new date/account/category/tag/link/search interaction proof.

Parent spot-check: the exact focused `node node_modules/tsx/dist/cli.mjs --test tests/domain/filter-facets.test.ts` command passed all 4 tests in the independent snapshot with sanitized environment; no failures or skips. Structural readback covered the matcher/identity helpers and store/hook propagation.

Snapshot limitation discovered during the later rendered UI audit: the independent T1 snapshot omitted root `index.html`, which T1's type/lint/domain checks did not require. A separate browser-audit snapshot added the byte-verified public application entry before building. Future build snapshots must include it; no claim is made that the unmodified T1 snapshot passed a Vite build.

Engram mirror remains pending: `mem_save` still reports `unknown_session` even with `session_id` omitted.
