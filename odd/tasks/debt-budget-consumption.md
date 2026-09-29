# Correct debt-budget consumption and audit perspective semantics

## Objective and authorization

Fix negative budget consumption caused by verified shared-expense debt mirrors,
then audit the nine screens' data across Real, Yo and Deudas for similar issues.
The user authorized the budget fix, cross-screen audit and four follow-up copy
corrections. Integration into main and pushing origin/main are now explicit.
Use only the repository's established Git SSH transport to its configured origin;
no deployment, unrelated remote access or financial-data transfer is authorized.
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
  authorized by ODD; main is the standing integration preference. The user now
  explicitly requests the completed feature pushed to origin/main without PRs.
- Route: delegated direct. Budget preparation and cross-screen mapping exceed
  four files; writer owns multiple non-trivial source/test files. Parent owns this
  document; the sibling audit remains read-only unless separately authorized.
- TDD on: user's explicit session choice. Budget runner:
  `pnpm exec vitest run src/domain/analytics/budgets.test.ts`.
  Related runner: `pnpm exec tsx --test tests/domain/debt-flows.test.ts`.
- RDD on (global); assess the committed candidate from the base above and follow
  native consent/transitions when due. Do not claim approval from tests alone.
- Delivery strategy: `exception-ok`; user explicitly approved `size:exception`
  after the forecast exceeded 400 lines, retaining direct main delivery without
  PRs. Prior commits total 362 authored lines; four copy changes, existing-test
  assertions and this record bring the updated forecast to approximately 460.
  This delivery exception does not waive native RDD or functional checks.
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

- [x] T2 — Explain negative expenses consistently without changing metrics.
  - Delegated direct: four view files plus their existing rendering tests exceed
    mapping/writer triggers. Reuse the bounded `negative_expense_copy` worker.
  - Correct Overview, CashFlow, Categories and InsightsPayees explanations:
    negative expenses can reflect refunds or debt allocations, not always cash
    returned. Preserve all calculations, signs, filters and existing fixtures.
  - TDD remains on: observe RED then GREEN with `pnpm exec vitest run` on the
    four existing component tests; run full UI, type-check, lint and diff check.
    Rendered component regressions cover this text-only boundary; no new browser
    sweep is needed. Rollback: only the four strings and their test assertions.
  - Commit on the feature branch, assess from the pending base above and follow
    native review transitions. Main integration and remote delivery are explicit.

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
- Four audit findings corrected in T2: OverviewPage.view.tsx:123,
  CashFlowPage.view.tsx:99, CategoriesPage.view.tsx:96 and InsightsPayees.tsx:67
  previously described every negative expense as a refund. The explanations now
  distinguish refunds from debt allocations without changing signed metrics.
- Implementation/tests/contract diff: 225 authored lines in three files.
  Work-unit commit: `38fd456` (`fix(budgets): orient verified debt mirrors as
  consumption`), 349 lines including this record. Native assessment against the
  base above: medium (`executable_change`), not due (`under_budget`); no approval
  receipt claimed. The same base applies to the evidence-only follow-up.
- Local `main` was fast-forwarded to `38fd456` under the standing integration
  preference. No push or other remote operation performed. Existing registry
  edits and the earlier pCloud task update were preserved and excluded.
- T2 RED: four copy assertions failed against the old wording, with 19 other
  tests passing. GREEN: all 23 tests in the four existing component suites passed.
  Runner: `pnpm exec vitest run src/presentation/pages/OverviewPage/OverviewPage.test.tsx
  src/presentation/pages/CashFlowPage/CashFlowPage.test.tsx
  src/presentation/pages/CategoriesPage/CategoriesPage.test.tsx
  src/presentation/pages/InsightsPage/components/InsightsPayees/InsightsPayees.test.tsx`.
- T2 parent verification: `pnpm test:ui` passed 321/321 across 81 files;
  `pnpm test:node` passed 281 with 3 optional-private-data skips. Type-check,
  lint and diff check passed. Logs: `/tmp/debt-copy-{red,green,ui,node,types,lint}.log`.
  Eight source/test files contain 21 additions and 5 deletions; only four static
  Spanish explanations and matching visible-text assertions changed. No financial
  logic, fixtures, dependencies, styles or source data changed in T2.
- T2 work-unit commit: `0da026f`, 81 authored lines including this record; running
  authored total is 443. Native assessment of the pending slice found medium risk,
  409 net changed lines, and `slice_budget_reached`. Exact returned STATUS and
  START (`--consent=relay`) were executed. The user explicitly granted review
  for lineage `review-7cef0cf154ee315f`, target
  `sha256:75d69b63f4758522de3484be50200ff962166d021317786d12821f07b7f76371`.
  The compiled Codex reliability reviewer inspected all 12 immutable patches,
  returned no findings and approved the candidate. Exact native acknowledgement
  succeeded; the reviewed boundary advances to `0da026f`. No independent test
  execution was performed by that reviewer; functional proof is recorded above.
  Local main was fast-forwarded to the reviewed commit. No source correction was
  needed after review; this follow-up changes only the evidence record.

## Next step

Implementation, verification and native review are complete. Delivery is the
explicitly authorized push of main to origin, including this evidence-only
follow-up after its native assessment. Verify local/remote main equality on
delivery. Engram mirror remains host-blocked; unrelated dirty files stay excluded.
