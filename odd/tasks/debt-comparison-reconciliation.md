# Make perspective comparisons additive without changing the ledger

## Objective and authorization

Implement the accepted proposal: present an explicit debt reconciliation adjustment
in Comparativa and clarify signed expense labels elsewhere. The user approved
implementation after the cross-screen audit. Earlier conditional authorization
permits commit and push to main once evidence and tests establish safety.

- Comparison identity: `Yo + Debt adjustment = Real`, with the same filters.
- Adjustment: `Real - Yo`, for net, income, expense and transfer amounts, including
  every category node. It is neither account balance nor necessarily cash spent.
- This supersedes the UI comparison contract in `odd/tasks/perspective-comparison.md`;
  the underlying ledger identity `Yo = Real + Debt ledger` remains unchanged.
- Preserve raw postings, account balances, general aggregators, budgets, attributed
  spending, transaction exports and all other numeric values. No reclassification.
- Keep the established UI and Spanish copy. Technical artifacts remain English.
- Preserve unrelated `.atl` registry edits and `odd/tasks/pcloud-cli-env.md`.
- No private financial amounts in committed fixtures or documentation. Browser
  access to the user-authorized local app is read-only; no vault/backups/env reads.
- Remote scope: established Git origin `git@github.com:thexenons/myexpenses-analysis.git`
  using its existing Git transport, main push only. No deployment or live sync.

## Workflow

- Base: `5c390ca7c616aeb695ce6082a4786b039d064828`.
- Branch: `fix/debt-comparison-reconciliation`.
- Delegated direct: mapping exceeded four files; each bounded writer owns several
  non-trivial source/test files. Parent owns tracking, verification and delivery.
- TDD on, retained from the explicit session choice. Observe RED before source
  fixes with `pnpm exec vitest run <focused files>`; then GREEN and applicable
  full checks. Existing Node runner is `pnpm exec tsx --test <focused files>`.
- Native RDD on (global). Assess each work-unit commit from the last reviewed
  boundary, initially the base above; follow native transitions when due.
- Delivery: established direct-main / size-exception policy, no PR. Forecast
  approximately 350-400 authored lines including tests and this record, in two
  behavior-focused commits. Do not shrink tests or formatting to fit a budget.
- Engram mirror `odd/debt-comparison-reconciliation/tasks` remains pending: the
  host prohibits agent-attributed memory calls without registered runtime identity.
  This file is the local recovery record; no memory calls are permitted.

## Tasks and acceptance

- [x] T1 — Reconcile the three comparison readings.
  - Delegated writer: `interface_semantics_audit`; model, labels, views and tests.
  - Single derived adjustment rule; leave source/aggregate objects unchanged.
  - Consistent order: Yo, Ajuste por deudas, Flujo real in cards, breakdown table
    and all category depths; preserve the four metric choices and filter behavior.
  - Clearly explain the equation and distinguish adjustment from balance/spending.
  - RED/GREEN: shared expenses/refunds, direct charges, income, transfers, FX,
    empty/zero values and category/account/date restrictions; unchanged source
    amounts and other page metrics. Verify category and summary reconciliation.
  - Rollback: comparison presentation/model and its regression tests only.
- [x] T2 — Clarify signed expense presentation without recalculating it.
  - Delegated writer: `responsive_component_audit`; Overview, Categories and
    Accounts labels/explanations plus focused tests. No numeric changes.
  - Visible debt-allocation context next to Overview expense KPI; distinguish
    net expense presentation from signed expense movements in relevant charts
    and selectors. Do not imply allocations are returned cash.
  - RED/GREEN: visible explanation without opening disclosure, expense/income
    mirror contexts where relevant, exact values preserved, updated accessible
    selector/legend names. Keep responsive UI contained.
  - Rollback: only these presentation strings and their assertions.

## Verification and evidence

- Prior read-only audit: 27 actual route/perspective combinations; 2,282 synthetic
  assertions across 14 scenarios; 348 UI and 65 domain tests passed, two optional
  reference-data checks skipped. No general numerical sign defect was found.
- Final checks: focused RED/GREEN, full UI, synthetic-focused financial Node
  tests, types, lint and diff check. Avoid optional private-dataset probes.
- Runtime: isolated synthetic browser suite plus targeted desktop/mobile review
  of comparison labels, equation, category metrics and visible expense context.
  Browser worker owns temporary harnesses; no screenshots of private data saved.
- T1 focused RED: 15 failures / six passes before production; GREEN: 21/21,
  including nine synthetic scenarios. Scoped lint/app types and diff check pass.
  Production/test ownership is six comparison-page files, 156 authored lines.
- Browser RED against frozen old source: two comparator order failures and one
  signed-selector label failure at 320px. Logs `/tmp/debt-comparison-browser-red.log`
  and `/tmp/debt-label-browser-red.log`. Final browser GREEN/full checks pending.
- T2 RED: seven expected label failures; separate missing-context regressions
  observed before production. GREEN: 24 focused tests in four files. Changes are
  four presentation files, two existing tests and one new Overview signs test.
  Logs `/tmp/debt-presentation-t2-{red,context-red,green}.log`.
- Both writers are frozen. Parent full UI: 362/362 in 83 files; types/lint/diff
  checks passed. Existing non-comparison expectations also pass 2,282 producer
  assertions after changing only the comparison test's expected orientation.
  Logs `/tmp/debt-reconciliation-{ui,types-final,lint-final,t1-producers}.log`.
- Isolated full Node: 281 passed, three optional private-data checks skipped.
  The first source-only snapshot omitted tracked `compose.yaml`, causing one
  ENOENT contract-test failure. Copying that unchanged tracked config to the
  temporary snapshot fixed verification; no repository harness change needed.
  Final log `/tmp/debt-reconciliation-node.log`; all 14 changed source/test files
  matched the isolated snapshot byte-for-byte. No private data was copied.
- Focused browser GREEN: nine cases across desktop/390/320. A first 8/9 attempt
  read KPIs before lazy navigation settled; the test now waits for the exact
  destination heading. Three additional synthetic allocation checks confirm
  initially visible context and unchanged consumption.
- Final standard browser suite: 84 passed, three intentional device-specific
  skips, 4.2 minutes. Log `/tmp/debt-comparison-browser-final.log`.
  Synthetic comparison cards/category rows and selectors fit all three widths.
  A locator crop included the fixed navigation overlay; a subsequent clean
  viewport pass (3/3) proves complete allocation copy below the toolbar and above
  mobile navigation. Parent inspected the narrow viewport, not just DOM visibility.
  Evidence index: `/tmp/debt-comparison-visibility/evidence.md`. Servers stopped.
- T1 commit `8073baa`: 317 authored lines including tracking and its browser
  regression. Initial assessment required declaring T2's new untracked test;
  native STATUS obtained its canonical inventory, then explicit exclusion from
  this committed-only candidate resolved the assessment. Native result: medium,
  `under_budget`, review not due. Boundary remains `5c390ca`.
- T2 closes only its presentation strings/regressions and selector browser test;
  the shared browser file was staged by behavior so each work unit is coherent.
  All planned functional checks now pass; only the six documented optional/data
  or device-specific checks were skipped. No further product changes are needed.

## Next step

Commit verified T2, assess the pending slice from `5c390ca` and follow native
review before the explicitly requested main push. Then start the user's separate
transaction visibility / compact budget-detail request; do not mix it here.
