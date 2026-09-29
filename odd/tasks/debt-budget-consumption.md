# Correct debt-budget consumption and audit perspective semantics

## Objective and authorization

Fix negative budget consumption caused by verified shared-expense debt mirrors,
then audit the nine screens' data across Real, Yo and Deudas for similar issues.
The user authorized the budget fix and cross-screen audit. Other findings must
not silently change business semantics. No new remote operation is assumed.
Preserve dirty `.atl` registry files and `odd/tasks/pcloud-cli-env.md`; never use
private `.env`, backups or live services. Use only synthetic records and fixtures.

## Decisions and boundaries

- `debtsOnly` selects debt postings without changing their signs. Budgets negate
  every posting: a +5 EUR shared-expense mirror therefore becomes -5 EUR consumed.
  A direct card charge -10 EUR with a +1 EUR refund already consumes +9 EUR.
- Normalize only verified operational-mirror contributions in `debtsOnly`.
  Reuse the existing counterpart resolver; do not invert every debt posting or
  use absolute values. Preserve direct charges, refunds and invalid-link behavior.
- Keep current budget inclusion, original posting, currency, period and selected
  category contracts. Do not replace amounts/categories with the operational
  peer's: the Debt page's attributed EUR/cash semantics are intentionally different.
- Calculate a contribution once, then reuse it for totals, category tree and
  detail. Do not mutate source ledger data or general financial aggregators.
- Preserve `all`/`realCashFlow`, zero-allocation utilization, split effective-row
  selection, neutral inclusion policy and debt-to-debt behavior. No new exclusion
  policy or inferred category is authorized by this sign correction.
- Audit signed ledger metrics separately from attributed spending. Differences
  alone are not defects; reconcile documented modes, labels and source identities.

## Workflow and delivery

- Base: `d9225fe4dddf2ce5ca3825d26f2e55c78f788261`.
  Branch: `fix/debt-budget-consumption`. Local Conventional work-unit commit is
  authorized by ODD; main is the standing integration preference. Remote delivery
  for this new feature remains a separate user decision.
- Route: delegated direct. Budget preparation and cross-screen mapping exceed
  four files; writer owns multiple non-trivial source/test files. Parent owns this
  document; the sibling audit remains read-only unless separately authorized.
- TDD on: user's explicit session choice. Budget runner:
  `pnpm exec vitest run src/domain/analytics/budgets.test.ts`.
  Related runner: `pnpm exec tsx --test tests/domain/debt-flows.test.ts`.
- RDD on (global); assess the committed candidate from the base above and follow
  native consent/transitions when due. Do not claim approval from tests alone.
- Delivery strategy: `ask-on-risk`; forecast approximately 375 authored changed
  lines including tests, contract documentation and this audit record. Measure
  before commit; resolve an over-budget delivery before committing if necessary.
- Rollback: debt budget contribution resolution, matching domain/UI regressions
  and contract/audit documentation. Unrelated financial calculations are untouched.
- Engram mirror `odd/debt-budget-consumption/tasks` pending: host registration is
  unavailable and agent-attributed memory calls are prohibited until restored.

## Task and acceptance

- [x] T1 — Correct budget debt contributions and verify the three perspectives.
  - Delegated writer: `src/domain/analytics/budgets.ts`, its Vitest test, and a
    short contract clarification if needed. No broad refactor or dependency.
  - Observe RED before implementation; GREEN for mirror expense/refund, mixed
    direct-card/mirror debt, unchanged other modes, invalid/nonreciprocal links,
    same-sign/same-account/VOID peers, currency preservation, splits, categories,
    detail reconciliation, uncategorized/neutral policy and unallocated budgets.
  - Read-only sibling audit: Resumen, Flujo, Comparativa, Deudas, Presupuestos,
    Categorias, Cuentas, Patrones and Transacciones across all three modes;
    reproduce concrete findings with synthetic data and record true limitations.
  - Run focused budget/debt suites and affected presentation tests, full Node/UI
    suites, type-check, lint and diff check. Use the isolated synthetic Chromium
    harness for a budget mode regression if its fixture supports the scenario;
    do not confuse browser rendering checks with independent financial proof.

## Evidence and audit results

- Prior read-only reproduction: budget 100 EUR, shared expense 10 EUR split into
  5 own +5 debt => debt consumption -5 EUR/bar 0%; refund 2 yields -3 instead of 3.
  Direct card -10 +refund 1 already yields +9. Existing budget/debt tests did not
  cover the erroneous mirror contribution.
- RED: 5 expected failures before production edits. Final GREEN: 31 budget tests,
  50 tests including related budget components, and 16 debt-flow tests passed.
  Added 17 regressions; intermediate type/lint failures were corrected and rerun.
- Parent full Node: 281 passed, 3 optional-private-dataset tests skipped, no
  failures (`/tmp/debt-budget-node.log`). Full UI: 321/321 across 81 files passed.
  Types, lint and diff check independently exited 0; logs `/tmp/debt-budget-*.log`.
- Parent reran 185 synthetic assertions across five fixtures and three modes;
  shared expenses/refunds, direct cards, income mirrors and debt-to-debt transfers
  preserve signed identities. Another 42 debt/comparison/category-average tests
  passed in the read-only audit. No additional numerical defect was demonstrated.

| Screens audited | Verified contract |
| --- | --- |
| Resumen, Flujo, Categorias | Signed KPI/category/series metrics; composition separates debt allocations from refunds. |
| Comparativa | Signed partitions preserve Yo = Real + Deudas; attributed debt spending is separately named. |
| Deudas | Verified operational financing, recovery, attributed spending and balances remain distinct. |
| Presupuestos | Corrected contribution reconciles totals, categories and detail without mutating ledger rows. |
| Cuentas, Transacciones | Original signed movements, historical balances, sorting and CSV remain unchanged. |
| Patrones | Magnitude ranking retains signed amounts and complete CSV results. |

- Actual-source Chromium desktop audit: 3/3 tests, 27 route/mode combinations
  passed in 18.4s. Independent SQL fixture budget 100 EUR: consumption/utilization
  Real 9/9%, Yo 13/13%, Deudas 12/12%; signed movements 12/7/-5 EUR and signed
  expenses 9/13/4 EUR. Debt detail +5/-1/+10/-2 reconciles to 12; raw transaction
  signs remain +5 (mirror) and -10 (card). Parent inspected the debt-detail capture.
- Scope/date filters persisted; no JavaScript errors or external requests.
  Diagnostic setup/locator failures were corrected only in temporary artifacts:
  ESM, native counterpart UUID, dated allocation, Chromium libs and locators.
  Browser: `/tmp/myexpenses-mode-audit/rendered-run.log`; retained snapshot and
  screenshots: `/tmp/myexpenses-browser-source-eh8uXH/source/`.
- Reproduction: `node --import ./node_modules/tsx/dist/loader.mjs
  /tmp/myexpenses-mode-audit/producers.mjs`; browser runner uses the existing
  `MYEXPENSES_BROWSER_RUNTIME_LIB_DIR` with `node ./node_modules/tsx/dist/cli.mjs
  /tmp/myexpenses-mode-audit/run-browser.mts --project=desktop`.
- Limits: synthetic data only; no Firefox/WebKit or additional responsive sweep.
  The standard full browser/deployment suites were not rerun; the dedicated
  cross-mode audit, full Node/UI suites and budget regressions cover this change.
- Four audit findings remain read-only proposals: OverviewPage.view.tsx:123,
  CashFlowPage.view.tsx:99, CategoriesPage.view.tsx:96 and InsightsPayees.tsx:67
  incorrectly describe every negative expense as a refund. A debt allocation
  can yield -5 EUR with zero refunds. Clarify those labels without changing the
  signed metrics; seek scope approval rather than silently changing other views.
- Implementation/tests/contract diff: 225 authored lines in three files.
  Work-unit commit and native assessment pending; no remote operation performed.

## Next step

Commit and assess the verified budget fix, then report the four copy proposals
and the remaining remote-delivery decision. Engram mirror remains unavailable.
