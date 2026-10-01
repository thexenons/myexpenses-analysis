# Financial clarity and technical robustness

Implement the accepted 2026-10-01 audit in small independently verified units.
Fix misleading budget subset interpretation first, then improve budget pacing,
operational resilience and the visibility of useful financial statistics.

## Authority and constraints

- User authorized all proposed audit improvements, with linear budget-to-date.
- Preserve financial identities, debt semantics, currency and rollover handling.
- No private datasets, credentials or deployed services are needed for tests.
- Preserve unrelated changes in `.atl/.skill-registry.cache.json`,
  `.atl/skill-registry.md` and `odd/tasks/pcloud-cli-env.md`.
- Strict TDD is enabled by AGENTS.md: observed RED, GREEN, then refactor.
  UI/domain runner: `pnpm exec vitest run`; Node runner: `pnpm test:node`.
- Delivery: auto-chain, stacked-to-main work units, following the user's prior
  explicit request for successive small deliveries to main. No PR requested.
  Initial branch/base: `feat/audit-improvements-20261001` / `f45c7e6`.
- RDD is on (global). Candidate consent is separate; prior grants are consumed.
- Engram mirror: `odd/audit-improvements-20261001/tasks`. Synchronization resumed
  after A5, but the latest post-compaction runtime hook again reports no
  authoritative registered session identity and forbids agent-attributed calls.
  Mirror update is pending until registration is restored; retain local progress
  and never invent or select an ID from observations.

## Decisions and acceptance

Expected consumption to date is distinct from forecast final expenditure.
Monthly pace uses inclusive elapsed calendar days divided by period days.
Annual pace uses elapsed months plus the elapsed fraction of the current month,
avoiding a jump only at month-end. Show the basis explicitly in details.
Use assigned budget including incoming rollover, not outgoing rollover; never
change underlying totals. Suppress pace conclusions for non-date subsets,
date cuts missing part of budget-start-through-today, missing/invalid limits
or unsupported periods. A complete date-only prefix through today is eligible
even though full-period availability still needs A1's filtered warning.
Test dates, leap years,
future postings and refunds. A linear allowance is a reference, not a promise.

Operational changes must preserve current release and rollback safety. Never
prune user backups, run destructive cleanup on real data, or modify deployment
credentials. Availability and freshness are independent signals.

A5 retention policy: keep five app-owned releases, always including the active
and immediately previous current targets. Cleanup occurs only after durable
state commit under the worker lease; any state/current mismatch skips cleanup.
A versioned marker identifies newly generated releases. Preserve unknown,
legacy unmarked and symlinked entries rather than infer ownership from names.
No age grace is promised: the five-release count limits newly managed growth;
legacy artifacts require a separately authorized manual inventory/cleanup.
Cleanup failure is nonfatal to an otherwise successful publication. Do not
change the local download CLI. Retention supports rollback, not stale asset URL
availability: current Nginx resolves assets only through the active release.

A6 records private worker diagnostics under the deployment root: last attempt,
last successful check (including unchanged backups), confirmed publication,
consecutive failures and the last observed served pCloud file modification
timestamp. Preserve availability checks and never expose diagnostics publicly.
No default backup-cadence alarm: source modification time is not verified data
capture time, and unchanged backups can legitimately accompany successful polls.
Persistence failures are nonfatal; cancellation is not a failed sync. Safe
operator documentation must explain how to inspect the private status locally
and distinguish stopped polling from old source data without credentials.

Reuse existing historical means, elapsed comparisons, previous-year comparison
and merchant-frequency metrics. Keep category rows compact; extra detail is
disclosed on demand. Savings rates require an explicitly eligible scope and
positive income; no generic debt-perspective ratio or invented net worth.

## Tasks and route

Forecast: 1,500–2,500 authored changed lines across independent units; around
400 per unit is advisory, not a reason to omit tests or compress code.
All tasks are delegated: multi-file logic, preparation reads and execution
checks trigger the mandatory writer/verification routing rules.

- [x] A1 Fix all budget subset filters and rename static consumption label.
  Checks: budget domain and page regressions, typecheck, lint, relevant UI suite.
- [x] A2 Implement tested linear budget-to-date domain calculations.
  Checks: calendar/rollover/refund/filter/currency edge cases and full budget tests.
- [x] A3 Present compact pace guidance globally and per budget category.
  Checks: UI tests and synthetic desktop/mobile keyboard/browser scenarios.
- [x] A3F Align the budget category disclosure icon with the category title.
  User reported vertical mismatch after A3. Checks: browser geometry on desktop
  and mobile, wrapped names, details open/closed, and keyboard behavior.
  Reopened after `8b7823c`: alignment passed but user reports the disclosure
  is too close to the top. Match the actual Categories tree row spacing while
  preserving first-line alignment and the 44px interactive target.
- [x] A4 Add repository CI for existing checks and isolated browser smoke.
  Checks: workflow validation and local equivalents; disclose hosted-run limits.
- [x] A5 Add bounded release retention with protected active/rollback releases.
  Checks: synthetic filesystem, leases, symlink/failure and rollback regressions.
- [ ] A6 Add sync freshness observability separate from service readiness.
  Checks: fresh/stale/failing/no-new-backup worker scenarios; operational docs.
- [ ] A7 Surface existing comparison highlights and on-demand cumulative chart.
  Checks: consistent scopes, partial/history gaps, accessible compact layouts.
- [ ] A8 Expose category gross expenses, refunds and net in detail.
  Checks: existing accounting identities, no duplicate hierarchy totals.
- [ ] A9 Add eligible completed-period savings-rate trend.
  Checks: income denominator, transfer/debt/scope rules and incomplete periods.
- [ ] A10 Run final cross-screen functional and responsive acceptance.
  Checks: applicable full suites, synthetic desktop/mobile and navigation checks.

## Evidence and delivery

- Read-only audit reproduced A1: budget 100, consumption 60; minimum amount 30
  leaves consumption 40 but old `isFilteredComparison=false` claims available 60.
- Parent verified the omitted filter condition and misleading label in source.
- A1 completed: eight missing subset filter families are recognized, including
  active zero-valued amount bounds. Static meter now says "Consumo del presupuesto".
  Financial totals and filtering implementation are unchanged.
- A1 TDD: focused tests RED (11 expected failures), then GREEN (55/55).
  `node node_modules/vitest/vitest.mjs run` passed 452/452; local TypeScript
  checks for node/app/browser passed; local Oxlint passed with no warnings;
  `git diff --check` passed. Parent independently repeated the two focused
  budget domain/page suites: 55/55. Sanitized Node 24.19.0 environment.
  pnpm could not start without Corepack download; installed local CLI binaries
  supplied equivalent checks without network or dependency changes.
- A1 browser check not run (domain + rendered component regression coverage);
  final responsive/browser acceptance remains A10. Rollback A1 independently
  via its budget domain/page source and accompanying tests (four files).
- A1 commit: `78effc6` (166 authored changed lines including this recovery doc).
  Native committed-only assessment: medium, `under_budget`; review is pending
  for the slice from `f45c7e6`. No review grant or receipt is claimed.
  Initial broad worktree
  assessment was unavailable due to explicit untracked-file scope; delivery
  assessment will use the committed-only unit, excluding unrelated user edits.
- Running authored count: 507 across A1/A2 commits (net slice 495).
  Last reviewed boundary: `7ade54a`; original base: `f45c7e6`.
- A2: new pure `analyzeBudgetPace(analysis, today)` calculates the global and
  inclusive per-category allowance and signed consumption through cutoff.
  Difference is allowance minus consumption; positive means below allowance.
  MONTH uses the resolved period length (including custom month starts).
  YEAR uses twelve calendar months with a fractional current month.
  No underlying totals change; future postings are excluded only from pace.
- A2 TDD: missing-helper RED followed by GREEN; parent found default current
  month/year filters cap at today, prompting a failing regression and safe
  date-prefix support. One shared non-date subset predicate preserves A1.
  Focused budget domain/comparison 72/72 and full UI 460/460 passed; three tsc
  projects, Oxlint and diff check passed using installed local binaries.
  Parent independently repeated focused domain/comparison checks: 72/72.
- A2 rollback: new `budget-pace.ts`, its tests in `budgets.test.ts`, and added
  subset metadata in `budgets.ts`; A1 financial warning remains unchanged.
  Browser is N/A for this pure domain unit; UI integration remains A3.
  Loaded postings do not establish historical completeness: A3 must say
  recorded consumption, not promise complete or future spending.
- A2 commit `6d0f934`. A1+A2 slice assessed medium, slice budget reached.
  User granted candidate review; reliability reviewer found no findings.
  Native lineage `review-9dc0d63c74ae2cc9` approved and acknowledged; authority
  burned. A1/A2 merged fast-forward and pushed to origin/main at `6d0f934`.
  Source checks above preceded review; no candidate changes after freeze.
- Each task records commands, results, commit, review and independent rollback
  boundary here. Tests/docs ship with behavior; never stage unrelated files.
- A3 adds a compact linear-reference panel and category allowance deltas, with
  date/basis/rollover explanations in native disclosures and explicit neutral
  unavailable states. No financial totals or existing comparisons change.
  Full financial scope is required: the default realCashFlow perspective is a
  non-date subset and intentionally unavailable. An aligned month-to-date date
  prefix in the full scope is eligible and tested in the browser.
- A3 TDD: three missing-region regressions failed before implementation; final
  UI suite 465/465, three TypeScript projects, Oxlint and diff check passed.
  Parent repeated budget page tests 18/18. Synthetic browser pace scenario
  desktop/mobile-390 passed 2/2 and adjacent budget scenarios passed 4/4.
  Keyboard disclosure and no horizontal overflow assertions passed. Parent
  inspected synthetic desktop/mobile full-page screenshots; screenshot capture
  of sticky controls is not a physical-device interaction audit.
- A3 artifacts: /tmp/myexpenses-a3-synthetic-desktop.png and
  /tmp/myexpenses-a3-synthetic-mobile-390.png. Rollback is the budget page subtree
  changes plus financial-explainability browser scenario; A1/A2 remain intact.
  Commit `5d440d3` (294 authored lines) assessed medium, `under_budget` against
  `6d0f934`; no new review was due. Merged and pushed to origin/main.
  Last reviewed boundary remains `6d0f934`; A3 stays in the pending review slice.
- A4 adds two read-only-permission GitHub Actions jobs: locked lint/types/Node/
  UI/synthetic deployment checks, and isolated synthetic desktop/mobile smoke.
  Official checkout and pnpm/setup action commits are pinned; setup runtime
  is Node 24 and require-lockfile enables frozen installation. No secrets,
  private vaults or real deployment are used. Browser installs headless Chromium.
- A4 TDD: workflow contract failed ENOENT, then passed. Full Node run exposed
  a pre-existing missing-index failure verified on base `5d440d3`; authorized
  readiness fix adds only named-export barrels to InformationDisclosure and
  BudgetReferenceControls, preserving the existing architecture test.
- A4 final verification: Node 287 passed, 3 optional private-data skips;
  UI 465/465; synthetic deployment 1/1; browser smoke 6/6; all three tsc
  projects, Oxlint, YAML parsing and diff check passed. Parent repeated CI and
  component-structure tests 8/8. Checks used sanitized local Node 24 binaries.
  The hosted runner, fresh pnpm installation and browser-library setup have
  NOT run here; first GitHub-hosted execution remains validation outstanding.
- Official sources: https://github.com/pnpm/setup/blob/v3.0.0/README.md,
  https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1,
  https://playwright.dev/docs/browsers. Parent verified setup's automatic frozen
  installation and runtime input against official docs.
- A4 rollback: workflow, CI contract test, browser-testing docs paragraph and
  two export-only barrels. No production runtime behavior changed.
  Commit `bd9092f`; A3+A4 assessed high (workflow process boundary), 404 net
  authored lines. User granted the slice's review. Four native lenses passed
  with no findings; `review-c0bf57c5f452086e` acknowledged, authority burned.
  A4 merged and pushed to origin/main at `bd9092f`. Hosted CI result has not
  been retrieved; no claim of a successful hosted run.
- A5 identifies generated releases through an app-written versioned marker,
  retains five with active/prior pins, and prunes only after successful state
  persistence with current/state reconciliation under the existing lease.
  Ownership, marker, containment, directory/link and tree checks fail closed.
  Unknown/legacy artifacts stay untouched; cleanup errors cannot undo publish.
  Documentation distinguishes bounded managed growth from total disk usage.
- A5 TDD: three expected regressions failed before implementation; final focused
  checks 41/41; full Node 295 passed with 3 optional private-data skips;
  synthetic deployment 1/1; all three TypeScript checks, Oxlint and diff check
  passed. Parent repeated orchestrator tests 29/29. No UI suite repeated for
  this backend-only unit; no real deployment cleanup was executed.
- A5 rollback boundary: orchestrator source/tests and deployment guide only.
  Existing state-write durability behavior is unchanged. The lease protects
  cooperating workers, not a malicious/non-cooperating same-user filesystem
  writer. Keeping old release directories does not serve their asset URLs.
  Commit `7ade54a`, medium committed-only assessment, 411 authored changed lines.
  User granted review; native reliability lens found no defects. Lineage
  `review-66cc92f770d0f502` approved and acknowledged; authority burned.
  Fast-forwarded and pushed to origin/main at `7ade54a`.
- A3F reproduced the reported mismatch: first-line/glyph center difference
  16.45px desktop without pace, 10.50px mobile with pace. Budget-local CSS now
  starts summary cells consistently and offsets the first title line relative
  to its line height and the existing 44px disclosure target. Shared tree
  styles and all financial behavior remain unchanged.
- A3F strict TDD: geometry regression failed on both viewports before the fix;
  final desktop/mobile browser checks 6/6, measured states within 0.50px,
  including pace/no-pace, details and child toggles, wrapped titles and keyboard
  targets. Relevant Vitest 28/28, three TypeScript projects, Oxlint and diff
  check passed. Parent repeated page tests 18/18 and inspected cropped rows.
  Full UI suite not repeated for this local CSS change; browser is Chromium,
  not a physical-device or cross-engine audit. Evidence: /tmp/a3f-before-*,
  /tmp/a3f-after-* (synthetic). Rollback: budget table CSS and browser regression.
  Commit `8b7823c`, medium assessment `under_budget`, 118 authored changed lines
  against reviewed boundary `7ade54a`. Merged/pushed to origin/main; A3F remains
  in the pending review slice. No new review receipt is claimed.
- A3F spacing follow-up matches the actual Categories disclosure-to-border
  inset, not only computed row padding. Categories centers its disclosure
  within a taller header; the budget-local top inset now compensates while
  preserving first-title-line alignment, shared horizontal/bottom padding
  and the existing 44px interactive target. Categories itself is unchanged.
- Spacing TDD: browser comparison failed on desktop/mobile before the fix.
  Categories button/glyph top insets are 13.406/27.406px; Budget was 5/19px
  and is now 13/27px. Alignment remains within 0.50px in all tested states.
  Final synthetic Chromium checks passed 8/8; focused UI checks 29/29;
  app/browser TypeScript, Oxlint and diff check passed. Paired screenshots
  `/tmp/a3f-spacing-{before,after}-{categories,budget}-{desktop,mobile-390}.png`
  were inspected. Mobile compact-height bound increased from 185 to 195px
  to accommodate requested spacing without compressing financial content.
- Direct Node TypeScript is blocked by unfinished, untouched A6 tests at
  `worker.test.ts:45,83`. Browser verification therefore used an isolated
  HEAD archive overlaid with only the two A3F files; private data and A6 WIP
  were excluded. Full UI/Node suites were not repeated for this CSS-only fix.
  Rollback remains the budget-local CSS and accompanying browser regression.
  Engram mirror is pending due to the runtime session-registration restriction.

## Next step

Resume A6, then A7–A10; the A3F Categories-equivalent spacing fix is verified.
A6 is interrupted: only `scripts/sync-pcloud/worker.test.ts` contains five new
observability tests. RED has NOT run; no production/status/docs changes exist.
Preserve this partial file and resume A6 with its focused RED command later.
A6 exploration is complete: status belongs in a private worker-owned
file, successful no-op checks advance poll freshness but not publication time,
and availability remains independent. Do not infer capture time from pCloud
file modification metadata or invent a default expected backup cadence.
