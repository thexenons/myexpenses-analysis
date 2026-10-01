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
- [ ] A3 Present compact pace guidance globally and per budget category.
  Checks: UI tests and synthetic desktop/mobile keyboard/browser scenarios.
- [ ] A4 Add repository CI for existing checks and isolated browser smoke.
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
- Running authored count: 166 committed lines. First review boundary: `f45c7e6`.
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
  A2 commit and native slice assessment pending in this snapshot.
- Each task records commands, results, commit, review and independent rollback
  boundary here. Tests/docs ship with behavior; never stage unrelated files.

## Next step

Commit and assess A2 with A1's pending slice, then implement A3 presentation.
