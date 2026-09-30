# Clearer information hierarchy across the interface

## Objective and authority

Prioritize actionable controls, amounts and comparisons. Move long static or
technical explanations behind explicit Information disclosures, while retaining
every active caveat that changes how a number must be interpreted.

The user explicitly authorized audit, analysis, planning, implementation,
commits and pushes to main without further interaction. This is organic direct
work, not SDD. Audit is complete; the checklist below precedes source changes.

Task identifier: `ui-clarity-20260930`. Every commit created for this task,
including documentation/bookkeeping, must include `[ui-clarity-20260930]` in its
Conventional Commit subject. No AI attribution. Branch:
`feat/ui-clarity-20260930`; starting main: `b1b2760`.

## Audit and analysis

The source audit covered all nine analytics routes, root redirect/404, the vault
gate, global filters, metadata disclosure and budget transaction dialog. Repeated
page descriptions plus panel descriptions plus technical notes create competing
levels of explanation. Budgets is the strongest evidenced density problem:
controls, long caveats, KPIs and a secondary ledger precede its category tree.
Other views already disclose some secondary explanation and need smaller edits.

| Surface | Primary information / visible caveat | Suitable for Information |
| --- | --- | --- |
| Overview | KPIs/chart; balances use account history through cutoff, flow uses selected postings | Reconciliation method and detailed gross/refund/allocation composition |
| Cash flow | KPIs/charts; consolidated result is not available cash; real scope and own-transfer interpretation | Repeated methodology, detailed transfer composition |
| Comparison | Perspective figures/category comparison; movements are not balances; debt adjustment is not a ledger balance or necessarily expenditure | Algebraic method and hierarchy aggregation explanation; preserve numeric reconciliation |
| Debts | Balance/selection/movements; signs do not establish who owes whom; balance and selected movement are different quantities | Longer chart-method descriptions |
| Budgets | Controls, current/budget, reference/mean, income and category tree; filtered cut, full limits/no proration, date basis, unavailable/history/unit states | Secondary allocation/rollover ledger, technical scope method, hierarchy implementation and historical provenance |
| Categories | KPIs/selectable tree; net/refund meaning, hierarchy and incomplete/noncomparable history | Existing average-method disclosure is a good pattern; avoid unnecessary redesign |
| Insights | KPIs/patterns/coverage; descriptive patterns do not imply cause or prediction | Only redundant static introductions; keep useful coverage caveats |
| Transactions | Totals/table/pagination/export/details; all-result scope and compensating-transfer interpretation | Only repeated static methodology; preserve native currency/rate/source transaction details |
| Accounts | KPIs/inventory; true cutoff balances differ from category-filtered movements | Repeated graph-method descriptions |
| Shared controls/states | Active filters, period, perspective, loading/errors/empty states and lock action | Metadata and advanced criteria already use disclosures; retain their financial/provenance caveats |

Source locators: `src/presentation/pages/*/*Page.view.tsx`, shared
`AnalyticsPage.tsx`, `Panel.tsx`, `Sidebar.view.tsx`, `FilterDrawer.view.tsx`,
`GlobalFilters.view.tsx` and `BudgetConsumptionDialog.tsx`. The route inventory
is `src/presentation/router/route-tree.ts`.
No generic Information disclosure exists; specialized disclosures must not be
repurposed indiscriminately. A minimal native details/summary presentation
primitive is justified only for the repeated informational pattern across views.

This was a code/test audit, not a new browser audit. Recent budget screenshots
provide the initial mobile clutter evidence. Final functional/visual checks are
required below; do not claim source inspection proves visual acceptance.

## Constraints and design

- Do not change domain analytics, financial amounts/signs, grouping/date/filter
  semantics, perspectives, datasets, security/vault behavior or dependencies.
- Keep scope/unit/date context and active interpretation warnings adjacent to
  numbers. Missing, zero, filtered, partial and unsupported must stay distinct.
  Do not hide serious warnings inside Information or rely on color alone.
- Reduce repeated paragraphs, not useful data. Preserve direct transaction
  inspection, hierarchy controls, income comparison and reference selection.
- Use explicit readable Spanish Information summaries, native keyboard behavior,
  visible focus, adequate touch targets and established typography/design tokens.
  No tooltip-only explanations or broad aesthetic redesign.
- Existing lockscreen stays minimal. Already-clear metadata, advanced criteria,
  empty/error states and transaction detail disclosures may remain unchanged.
- Read-only numeric outputs and existing domain tests are regression oracles;
  no real/private vault or financial-data access is necessary.

## Tasks and checks

- [x] C1 — Establish the smallest consistent Information disclosure pattern and
  simplify Budgets. Prioritize controls/KPIs/category comparisons, relocate
  secondary ledger/method explanation and retain concise critical scope warnings.
  Tests first: disclosure semantics plus visible filtered/no-history/unit states,
  reference/mean/income and transaction actions; isolated budget browser proof.
- [ ] C2 — Apply the hierarchy to Overview, Cash flow and Comparison. Preserve
  numeric reconciliation and all balance-versus-movement/debt-adjustment caveats;
  consolidate secondary method details without disturbing charts or totals.
  Tests first for visible caveats and initially closed/open informational content.
- [ ] C3 — Review and refine Debts, Accounts, Categories, Insights, Transactions
  and shared controls where the audit identifies actual redundancy. Retain good
  existing disclosures; document intentional no-change surfaces. Add focused
  copy/hierarchy regressions without expanding product scope.
- [ ] C4 — Independent final functional/visual validation across all nine routes,
  three perspectives and desktop/mobile, plus keyboard, narrow/intermediate
  widths, long labels, active filters, missing data and disclosure/dialog actions.
  Correct confirmed in-scope regressions, retain durable proof and complete
  tagged delivery/rollback documentation.

Routes: C1/C2/C3 delegated direct, because mapping/preparation and implementation
span multiple non-trivial presentation/test files; one writer. C4 delegated
independent verification, with any source correction returning to that writer.
Parent owns tracking, Git commits and main delivery. No parallel writers.

Strict TDD enabled by project AGENTS. Installed runner:
`node node_modules/vitest/vitest.mjs run <focused paths>`. Observe RED before
new presentation behavior, GREEN then refactor. Existing unchanged behavior
tests may start GREEN; never manufacture a production failure for test-only work.
Each slice runs focused/full UI-domain tests, TypeScript node/app/browser, Oxlint
zero warnings/errors and `git diff --check`; parent repeats one reported check.
Use source-only isolated Playwright with generated synthetic fixtures for runtime
proof. No full workspace Node suite/build/private import; the existing synthetic
snapshot's fixture import/encryption/static build is allowed.

Delivery: auto-chain / stacked-to-main, successive coherent work-unit commits
and authorized main pushes; no PR. Forecast 1,000–1,600 authored lines including
tests/docs, advisory only. Do not omit tests, code-golf or split artificially.

## Review and safety boundary

Repository RDD remains on and is not toggled. Last native reviewed boundary is
`a37eabc`; the prior budget guard/test slice has 378 under-budget lines and must
not silently disappear from subsequent diagnostic assessments.

The latest user instruction requires completing this task without interaction.
Do not synthesize candidate consent or grants/declines, and do not change the
user-owned switch. Record native risk diagnostics honestly; interactive native
review is not run for this no-prompt task. Use independent functional/visual
verification instead, never fabricate a native receipt or claim one exists.

Protect pre-existing dirty `.atl/.skill-registry.cache.json`,
`.atl/skill-registry.md` and `odd/tasks/pcloud-cli-env.md`. No `.env`, private
backups/data/vault/credentials, user service on5173, network installs or unrelated
configuration edits. Engram mirror is pending: no authoritative registered
runtime identity; agent-attributed memory tools are prohibited.

## Progress and rollback

Audit and C1 complete; C2 is next. C1 changes seven source/test paths (382
authored additions plus deletions). Native Information is closed initially;
the budget ledger and long method follow the category tree. Date/filter scope,
full-period/no-proration, missing/reference/mean context and parent/child
non-double-counting remain visible. Financial calculation paths are unchanged.

C1 observed RED before implementation and before the visible tree-caveat fix;
final focused Vitest 59/59, full Vitest 412/412, isolated browser 27/27,
TypeScript node/app/browser exit 0, Oxlint zero warnings/errors and whitespace
checks passed. Independent fresh snapshots passed 27 durable browser checks,
9 candidate and 9 baseline probes, and 13 focused tests; parent repeated the
13 tests successfully. Evidence: `/tmp/c1v-1_5778jh/` and writer logs
`/tmp/c1-*-final*`. The category tree moved 346px earlier at 1280px, 698px
at 390px, 719px at 320px and 382px at 900px, without reducing row height.
Exact financial outputs matched baseline across three perspectives. The tree
still requires scrolling; this is less clutter, not initial-fold visibility.

Initial browser run was 24/27: three old assertions expected the now-folded
ledger visible. Assertions now open Information and final 27/27 passed.
No manual screen-reader audit or native review approval is claimed. Protected
user files remain byte-identical. Commit identity is recorded after creation.

To identify this task's commits (read-only):
`git log --oneline --fixed-strings --grep='[ui-clarity-20260930]'`.
Rollback uses new revert commits in reverse chronological order for only these
identified commits; never reset/force-push or revert earlier budget features.
Do not execute rollback unless the user explicitly requests it.

## Authorized next task

After this UI clarity task is closed and pushed to main, immediately implement
localStorage persistence for filters and deliver it to main as a separate
feature. Restore only valid available criteria; stale or unavailable selections
must not be reapplied. Audit the existing filter lifecycle, privacy boundaries
and dataset changes before deciding the persistence schema and validation rules.
The user explicitly authorized autonomous implementation, commits and main push
for this follow-up. Keep its work units separate from this task's rollback group.
