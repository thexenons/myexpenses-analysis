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
- Engram mirror `odd/audit-improvements-20261001/tasks` is PENDING: the runtime
  prohibits agent-attributed memory tools until session registration returns.

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
- [x] A4 Add repository CI for existing checks and isolated browser smoke.
  Checks: workflow validation and local equivalents; disclose hosted-run limits.
- [ ] A5 Add bounded release retention with protected active/rollback releases.
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
  Last reviewed boundary: `6d0f934`; original base: `f45c7e6`.
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
  Commit and native review assessment pending in this snapshot.

## Next step

Commit and assess A4; then A5 retention, A6 freshness and A7–A10.
