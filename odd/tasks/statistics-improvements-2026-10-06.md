# Deliver statistical audit improvements

## Current status — accepted scope closed, 2026-10-06

The accepted implementation slices are delivered to main and user-confirmed in production. S01's duplicate panel was declined and S03 was deferred; neither original model was implemented. This closes the agreed work, not every recommendation in `docs/audit-statistics-20261005.md`.

| Task | Current disposition and delivered scope | Main delivery boundary |
| --- | --- | --- |
| S05 | Delivered; production user-confirmed. Subtle Mes actual shortcut, month-to-date, existing filters retained. | `1250fb6b197dd9910938a005b3039113065e758e` |
| S02 | Delivered; production user-confirmed. Clarify the budget-conditioned annual scenario, not a new forecast. | `2d9f7673196d7d5135d5a655d129c442c0f82460` |
| S04 | Delivered; production user-confirmed. Explain unverified coverage and absent records, not certify completeness. | `5692f4492c97c85215f6e7c00a15058edc03c55b` |
| S01 | Duplicate panel declined: existing Comparativa/Deudas fits the requested account-linked view. Universal person/share allocation remains unimplemented and outside the agreed scope. | Not applicable |
| S06 | Delivered; production user-confirmed after status simplification. Only unlinked income/expense postings without category remain in Qué revisar. | `e183af0c8bbae7470d9b29b770e6fa180ab3e966` |
| S03 | Deferred by the user, who records future items as ordinary future-dated transactions. No commitments/recurrence model implemented. | Not applicable |
| S07 | Delivered; production user-confirmed. Root-category contributions to selected net-expense differences with current/reference evidence. | `025d5098c76b276474285eeed478a2542b1c1852` |

Delivery identities above exist locally and are ancestors of current main `025d509`. Production acceptance is the user's confirmation, not a fresh automated deployment or remote CI claim.

## Objective and scope decisions

Improve orientation and interpretation while preserving financial arithmetic and existing filtered evidence. The original priority order was S05 -> S02 -> S04 -> S01 -> S06 -> S03 -> S07; subsequent user decisions narrowed or declined the slices above.

- S02 preserves recorded closed-month flow and estimated income minus full budget allocation. Observed spending in estimated months does not change their contribution; the accumulated flow is not available cash.
- S04 exposes unknown completeness; observed date endpoints and missing records cannot certify complete history or zero activity.
- S06's earlier two-signal/status-aware design is superseded. Legacy transaction statuses are inert; all non-VOID states are equivalent. VOID is ignored in active statistics, rows and exports. Financial balance/debt reconciliation remains intact.
- S07 is descriptive comparison evidence, not causal advice, a savings promise or a prediction. Active exclude/either category intersections disable both evidence actions rather than widen the cut; navigation changes the global period and recalculates comparison.
- No universal responsibility model, coverage-certification model, commitments engine, anomaly engine or forecasting engine was added.
- Preserve unrelated `.atl/skill-registry.md` and `.atl/.skill-registry.cache.json` changes. English technical artifacts and the established Spanish interface remain the language policy.

## Task checklist — current dispositions

Checked items mean the accepted slice was delivered, not the full original audit proposal. Unchecked declined/deferred models are not outstanding implementation tasks in this closure.

- [x] **S05:** shared accessible Mes actual action; calendar/filter semantics and compact footprint preserved after visual correction.
- [x] **S02:** prominent scenario interpretation for mixed estimates and all-actual years; calculations unchanged.
- [x] **S04:** ready/all-actual/empty-state coverage transparency; sparse records do not acquire unsupported completeness claims.
- [ ] **S01:** universal person allocations not implemented; duplicate panel declined in favor of existing Comparativa/Deudas.
- [x] **S06:** one traceable uncategorized caution with current selection context and transaction drilldown; reconciliation-state caution removed.
- [ ] **S03:** structured commitments and recurrence deferred; ordinary future-dated transaction behavior retained.
- [x] **S07:** lazily expanded root contribution union, signed current/reference/difference, safe evidence actions for both periods.

## Delivery and routing — current

- Current branch: main; delivered boundary `025d509`. Closure is a delegated, passive documentation correction only; the parent handles any closure commit/delivery.
- No new source changes, feature task, private-data build, dependencies, remote operation or native review is authorized by this closure.
- Earlier implementations used bounded delegated writers and per-task main delivery. Historical records below retain authored counts, test evidence, candidate consent and review outcomes.
- S07 committed assessment was medium, `review_due=false`, `under_budget`; it was **not native-review approved**. Its pending slice review boundary remains `e183af0`; production acceptance does not change that assessment.
- Source work units: S05 `dad3662` then `d48a277`; S02 `007b2e5`; S04 `343fe80`; S06 `c59f2d7` then status correction `a764e3e`; S07 `c067c8e`.

## Progress and next step — current

- Closure read the original audit, reconciled all seven dispositions, verified local delivery ancestry and spot-checked current code after CodeGraph lookup. No new material contradiction was found in the selected scopes.
- Current code evidence:
  - S05: `src/presentation/components/organisms/PeriodSelector/PeriodSelector.view.tsx:67–76` and `hooks/PeriodSelector.hooks.ts:95–97` in the same component.
  - S02/S04: `src/presentation/pages/BudgetsPage/components/AnnualProjection/AnnualProjection.Content.tsx:31–48`; `AnnualProjection.tsx:11` in the same component handles absent records.
  - S06: `src/presentation/pages/OverviewPage/OverviewPage.helpers.ts:49–63` and `OverviewPage.view.tsx:86–103`; `src/domain/analytics/filters.ts:620–622,673` documents inert statuses and excludes active VOID.
  - S07: `src/domain/analytics/comparison.ts:158–184` and `src/presentation/components/organisms/PeriodComparison/PeriodComparison.tsx:103–131`.
- Historical functional proof below is retained, not rerun or reclassified as closure proof. This passive closure uses document readback, local Git identity/ancestry checks and `git diff --check`; TDD and full builds are not applicable.
- No next product task is authorized. Allocation, commitments, certification or prediction work would require a separate user decision. The remaining action is the parent's documentation delivery, not another feature implementation.

## Historical chronology — not current pending work

These sections preserve decisions and evidence as they stood during implementation. Their forecasts, planned commands, pending deliveries and production checks are historical and superseded by the current status table. Original audit proposals remain historical recommendations, not a claim that their full models were delivered.

- Initial S05 branch: `feat/statistics-current-month-2026-10-06`; initial reviewed boundary `238e1d69ca8155dc2ee4d982d603b0c6fad67d97`.
- Initial S05 work unit `dad3662217924c53392e59ad2066928eda9d41d4`: 299 authored lines including tracking; its full native review is distinct from the later visual correction's under-budget assessment.

## S05 authorized edit surfaces
- `src/presentation/components/organisms/PeriodSelector/hooks/PeriodSelector.hooks.ts`
- `src/presentation/components/organisms/PeriodSelector/PeriodSelector.types.ts`
- `src/presentation/components/organisms/PeriodSelector/PeriodSelector.view.tsx`
- `src/presentation/components/organisms/PeriodSelector/PeriodSelector.module.css`
- `src/presentation/components/organisms/PeriodSelector/PeriodSelector.test.tsx`
- `tests/browser/filter-persistence.spec.ts`
- `.github/workflows/ci.yml` — add only the new scenario to the existing push smoke.
- This task document is maintained by the parent; it is not a worker source-edit surface.

## S05 planned commands
- `pnpm exec vitest run src/presentation/components/organisms/PeriodSelector/PeriodSelector.test.tsx src/presentation/components/organisms/GlobalFilters/GlobalFilters.test.tsx`
- `pnpm exec tsx tests/browser/run-isolated.ts --project=desktop --project=mobile-390 --grep="current month shortcut"`
- `pnpm lint`
- `pnpm type-check`
- `pnpm test:deployment` — existing isolated synthetic release pipeline with actual tsc/Vite builds. `pnpm build` with private production data remains unavailable without authorized passphrase input; no private secrets or backups accessed.
- `git diff --check`
- Use existing installed Node/pnpm and Playwright assets. No new dependency/system installs; request sandbox escalation if an otherwise valid required check is denied.
- Run source-mutating normalization before final functional verification and review freeze; no formatter script was identified.
- Parent spot check re-runs one reported command. Report failures or unavailable proof honestly.

## Historical S05 initial progress
- Accepted roadmap, per-task main delivery and the initial full task document are saved in Engram; local and memory readback are required before the writer starts.
- Read-only implementation map completed using CodeGraph. Shared period/calendar path confirmed by the parent.
- Existing unrelated registry changes remain untouched.
- First writer had partial proof; later continuation superseded environment-only browser failures with successful assertion-level runs. Test-only responsive labels and closed preset details were corrected without weakening expectations.
- Final seven-file source/test/CI diff: 168 additions and 3 deletions. Button copy is Mes actual, matching the established Spanish UI.
- Writer final proof: focused components 23/23 (7.98s), browser shortcut 3/3 on desktop/390/320 (32.1s), exact updated CI smoke 8/8 (31.5s), lint/all TypeScript projects/diff check exit 0, synthetic deployment 1/1 (25.49s).
- Browser checks cover keyboard, filter/granularity/preset preservation, reload, month-to-date, all-history, viewport containment, target size and no control overlap/overflow.
- Temporary public runtime archives were extracted without system installation; no private inputs or real network were used by synthetic deployment. Private-data build/deployed production remain unverified.
- Parent final spot check re-ran the focused component command: 23/23 passed, exit 0, 4.74s.
- Initial assessment limitations were resolved by assessing the exact committed candidate. Native risk was high because the CI workflow executes shell processes; eight files and 299 authored lines were reviewed.
- The user granted candidate review. Risk, resilience, readability and reliability reviewers each returned no findings; exact native acknowledgement burned authority for lineage `review-8bad0e9f43648103`. No correction was required.
- Final main push SHA and remote readback are recorded in Engram topic `odd/statistics-improvements-2026-10-06/delivery`; a pushed commit is not proof of deployment.
- Delivery batch: verified work-unit `dad3662` plus this passive closure record, targeted to main by non-force push. Do not include unrelated registry modifications.
- Next product step: confirm Mes actual in production before starting S02. The production URL and deployed outcome have not been verified.

## Historical S05 rollback boundary
S05 changes only the shared period selector, its focused tests and the added CI smoke scenario. Revert that coherent work unit without reverting prior financial features or unrelated local changes.

## Historical S05 visual correction — reopened 2026-10-06
- User feedback invalidated visual acceptance: the standalone shortcut adds an unbudgeted flex/grid item and can create an extra header row. Earlier containment checks did not assert stable layout footprint.
- Route: delegated direct; view/CSS plus component/browser regression changes require a bounded writer.
- Branch: `fix/current-month-selector-layout-2026-10-06`; base and reviewed boundary: `15974845b60a9a865d21b6513543488993e5b28e`.
- Scope: PeriodSelector view, CSS, component test and existing browser scenario only; preserve hook/calendar/filter semantics and unrelated registry edits.
- Design: place a quiet accessible current-month icon action within the period-mode group, with explanatory tooltip and keyboard focus, instead of an independent root item.
- Acceptance: no additional selector row caused by the action, stable compact footprint, no overlaps/overflow at desktop/390/320, usable compact and expanded all/month/custom modes, preserved existing functional behavior.
- Forecast: approximately 100–200 authored lines for this correction delivery unit.
- Proof: observe layout-regression RED before correction, then focused component/browser tests, lint, type-check, synthetic deployment and parent spot check. No private data or remote production inspection.
- Verified correction: 24px calendar icon grouped with the period mode, accessible Mes actual and tooltip, no calendar/filter changes. Layout RED measured +42.39px mobile height before correction; GREEN no action-induced width/height change across all/month/custom, compact/expanded, desktop/390/320.
- Checks: component RED 2 failed/23 passed, final GREEN 25/25; browser RED 3 failed/3 passed, final 6/6; broader smoke 10/10; lint/type-check/diff passed; synthetic deployment 1/1. Parent component spot check 25/25 and desktop/mobile screenshot inspection passed. Portable screenshot cleanup rechecked browser 6/6 and lint/diff.
- Work-unit commit: `d48a277`; 229 authored changed lines. Native committed assessment: medium, `review_due=false`, `under_budget`; no native review was run or approval claimed.
- Status: local correction verified; main push follows this passive evidence record. S02 remains deferred until user production acceptance.

## Historical S02 work unit — 2026-10-06
- User accepted S05 correction and authorized S02; main1250fb6 was previously pushed and verified, automated deployment proof is not claimed.
- Branch: `feat/scenario-interpretation-2026-10-06`; branch point: `1250fb6b197dd9910938a005b3039113065e758e`.
- Route: delegated direct; preparation and component/browser changes require bounded writer.
- Scope: clarify estimated annual contributions before the chart: expected income minus full budget allocation, unaffected by observed spending in estimated months, not available cash. Preserve actual closed-month semantics and distinguish linear reference from full-budget overspend.
- Allowed source/test surfaces: AnnualProjection/AnnualProjection.Content.tsx, AnnualProjection/AnnualProjection.test.tsx under src/presentation/pages/BudgetsPage/components; tests/browser/financial-explainability.spec.ts. No domain/math or broader design changes.
- Forecast: approximately 60–130 authored lines.
- Acceptance: prominent concise Spanish clarification before chart; existing detailed assumptions retained; synthetic component/browser checks prove wording and responsive usability without numeric changes.
- Checks: component RED/GREEN, relevant budget/projection tests, three-viewport annual trajectory browser scenario, lint/type-check/synthetic deployment/diff and parent spot check.
- Implementation verified: pre-chart conditional note for estimated months; all-actual years identify recorded net flow, not available cash. Existing subtitle/assumptions and all calculations preserved.
- Evidence: component RED 2 failed/40 passed; final UI/domain 42/42; browser desktop/390/320 3/3 with no tested accessibility violations or overflow; lint/type-check/diff exit0; synthetic production deployment1/1. Parent reran42/42 and inspected narrow screenshot.
- Work-unit `007b2e5`:88 authored lines including tracking, source/test72. Native assessment medium, review_due=false, under_budget; no native review approval claimed. Main push follows passive closure record; production acceptance pending.
- Rollback: revert S02 three-file presentation/test work unit, not domain calculations or S05.

## Historical S04 work unit — 2026-10-06
- User confirmed S02 in production and authorized S04. S02 main delivery: `2d9f7673196d7d5135d5a655d129c442c0f82460`.
- Branch: `fix/coverage-transparency-2026-10-06`; branch point: `2d9f7673196d7d5135d5a655d129c442c0f82460`. Pending accumulated review boundary remains `15974845b60a9a865d21b6513543488993e5b28e`.
- Route: delegated direct; presentation wording and synthetic regression coverage span multiple files.
- Evidence: savings trend already disclaims complete-history inference. Annual projection instead calls endpoint-inferred months complete/covered and uses zero for missing monthly flow.
- Scope: annual-projection ready/all-actual/empty-state coverage transparency, not arithmetic or certification. Explain observed date endpoints do not verify history and no recorded transactions need not mean no activity.
- Surfaces: AnnualProjection.Content.tsx, AnnualProjection.tsx, AnnualProjection.test.tsx under src/presentation/pages/BudgetsPage/components/AnnualProjection; tests/browser/financial-explainability.spec.ts.
- Forecast: approximately100–180 authored lines for this delivery unit; accumulated pending review may become due. Per-task main delivery remains selected; no PR chain planned.
- Acceptance: clearly visible unverified-coverage caveat, no unsupported completeness claims, retained S02 distinction and numeric outputs; sparse/empty records regression.
- Checks: component RED/GREEN, relevant projection/page/domain tests, synthetic browser desktop/390/320, lint/type-check/synthetic deployment/diff and parent spot check.
- User approved the exact additional BudgetsPage.test.tsx surface solely for two legacy copy expectations; those are the only edits there.
- Verified: initial RED4fail40pass; final UI/domain44/44; browser desktop/390/3203/3; lint/type-check/diff exit0; synthetic deployment1/1. Sparse fixture retains February Real0 and December-2 with warning; empty state fabricates no chart. Parent spot check and mobile screenshot completed.
- Source/test diff:81 additions18 deletions across five authorized files, no domain/calculation changes. Work-unit commit:`343fe80`.
- Accumulated native assessment from1597484:medium416lines10files, review_due slice_budget_reached. User granted; consolidated reliability review returned no findings. Exact acknowledgement burned authority for lineage `review-e3bc0fbf91f41664`; reviewed boundary advances to343fe80.
- Main delivery follows this passive closure record; user production acceptance pending. S01 waits for that boundary and explicit role definitions.
- Rollback: revert S04 presentation/copy tests, not S02 numeric semantics.

## Historical S06 audit and implementation — 2026-10-06

> Superseded design: the two signals and status-aware hook/table behavior here were removed by the transaction-status simplification below. Current S06 has only the uncategorized signal. The raw value-date quality API observation is not a claim that live Insights includes VOID; its shared hook projects active postings.

- User authorized full S06 audit and implementation. S04 production accepted; S01 duplicate summary rejected because existing Comparativa/Deudas covers the described account-linked representation; no universal person-allocation model implemented.
- Branch/base: `feat/overview-review-cautions-2026-10-06` / `5692f4492c97c85215f6e7c00a15058edc03c55b` (reviewed boundary).
- Route: delegated direct; multi-file pure eligibility/drilldown, hooks/view and component/browser proof.
- Audit: budget-local periods differ global dates, health is withheld for truncated comparisons; exclude budget alarms and pace predictions. Category averages/payee frequencies alone do not support anomalies. Empty-category aggregation includes legitimate transfers, so raw root count is unsafe. Value-date quality counts include VOID unlike active metric postings, so defer consolidation rather than mix denominators.
- Selected signals: unlinked income/expense postings with no category, and UNRECONCILED active postings. Verify bucket/category-type consistency and exact current-cut drilldown equivalence before implementation. Never classify linked debt mirrors or transfer-bucket rows as missing spending categories.
- Ranking: positive counts descending, deterministic stable-ID tie-break; transparent volume order, not severity. Counts are active postings, split parts may count separately; overlapping signals must not be summed into a unique total.
- Context: scope/date basis/date range and current global selection; preserve independent filters and granularity, narrow target filters without widening original cut. Disable actions while deferred search is pending. Show no-data separately from no selected signals; no claim of complete/safe history.
- UX: compact Qué revisar panel in Resumen, reuse existing styles/components, explicit explanation per signal and action to filtered Transacciones. Existing details remain. No new forecasting/person/coverage model.
- Scope: OverviewPage helpers/types/view/hooks/CSS/test; financial-explainability browser spec and narrowly scoped synthetic fixture variant; audit report `docs/audit-s06-cautions-20261006.md`. No domain arithmetic/router/CI changes.
- Forecast: approximately280–380 authored lines source/tests plus concise audit; proportional coherent task, no code compression for budget. Per-task main delivery remains selected. Reassess actual count before commit.
- Acceptance: deterministic eligibility/ranking, transfer/refund/VOID/debt/filter regressions, exact drilldown preservation, no-data/no-signal distinction, keyboard and desktop/390/320 layout.
- Checks: relevant component RED/GREEN, existing debt-flow regression, synthetic three-viewport S06 browser plus core smoke, lint/type-check/synthetic deployment/diff, parent spot check.
- User explicitly approved four additional hook/table test surfaces to repair ignored transaction statuses. Shared hook opts in; statistics default remains unchanged.
- Implementation verified: Overview24/24; shared/table hooks14/14; debt19/19; browser S06 desktop/390/3203/3; core smoke10/10; lint/type-check/diff exit0; synthetic deployment1/1. Parent combined component/hook38/38 and narrow screenshot passed.
- RED observed Overview16fail5pass, hook3fail11pass, browser three failures resolved without weakening assertions. NEUTRAL uncategorized rows and cache population isolation covered.
- Actual worker diff:489 additions24 deletions=513 authored lines, including67-line audit, across13 authorized files; parent tracking separate. Coherent target-table root fix expanded forecast. Before commit, request single-delivery exception versus artificial splitting; no source compression.
- User authorized exception-ok: one coherent S06 delivery and main push despite513 authored lines; no artificial split. Detailed user guide requested after delivery.
- Work-unit `c59f2d7`:14files533 authored lines including audit/tracking. Native risk medium, slice budget reached; user granted consolidated reliability review, no findings, exact acknowledgement burned authority for `review-8fff626404eabc02`.
- Status: verified locally and reviewed; single main delivery follows this passive record, production acceptance pending. No automated deployment claim.

## Historical transaction-status simplification — 2026-10-06
- User explicitly rejects reconciliation-state features: only VOID matters and must be ignored/not counted; all other transaction states equivalent. This supersedes S06 unreconciled caution and status-aware Transactions behavior, not financial balance reconciliation.
- Branch/base: `fix/ignore-reconciliation-status-2026-10-06` / `04d24f7a2177f7a44f66c157e0f7b8122a25b56c`. Route: delegated direct; cross-page UI, domain-filter compatibility and exports/tests.
- Audit found status counters/caution in Overview, source status in transaction details/related operations and budget-consumption dialog, two CSV columns, optional shared-hook status filtering and old preset restoration. No global status drawer/chips currently rendered.
- Design: legacy status filter becomes inert centrally; clear it when restoring full presets; remove shared status-aware opt-in. Keep imported source metadata/schema and VOID handling for compatibility; preserve active-only accounting/list/export behavior.
- Remove user-facing reconciliation-state descriptions, badges/counts/alerts and CSV estado/estado_myexpenses columns. Keep uncategorized review signal, adjusting copy for one signal. No financial calculation reconciliation changes, private inputs, dependency/schema/import migration or historical audit rewrite.
- Scope: exact mapped source paths in domain filters, shared analytics hook, store preset action, Overview helpers/types/view/hooks, Transactions hook/helpers/details/links, budget-consumption dialog and their direct existing regressions. Parent owns this task document.
- Acceptance: CLEARED/RECONCILED/UNRECONCILED same eligibility; old saved statuses including VOID cannot hide active records; VOID never included in financial totals/table/export; no reconciliation-state UI/CSV text; details/links/budget drilldown continue working.
- Tests: deterministic RED/GREEN, domain filters/facets/debt, UI/hooks/store/export, synthetic browser status-independent presets/VOID and revised S06 drilldown at desktop/390/320, existing core smoke, lint/type-check/synthetic deployment/diff and parent spotcheck.
- Forecast: approximately300–400 authored lines plus tracking. Existing per-task main delivery remains; user authorized single coherent S06 delivery, assess actual correction size before commit.
- User approved ten additional search/CashFlow/subset/test surfaces after final audit. All non-VOID states are now equivalent across filtering, search, presets and analytics availability; imported provenance remains intact.
- Verified: UI139/139 plus CashFlow/projection/budgets94/94; domain54passed/1private opt-in skipped; savings14/14; browser15/15 desktop/390/320; core10/10; lint/type-check/diff pass; synthetic deployment1/1. Parent repeated94/94 and reviewed narrow screenshot.
- Prior optional golden test read local input before skipping; no contents inspected/output/transmitted. Authorized safeguard now requires MYEXPENSES_ALLOW_PRIVATE_GOLDEN=1 before access; unset throughout final checks. Private production build/deployment not attempted.
- Correction source/tests37files311add219del=530 authored lines. Retain user-approved single coherent S06 delivery (exception-ok), with native review before delivery; no artificial split.
- Work-unit `a764e3e`:38files546 authored lines including tracking. User granted native medium-risk review; consolidated reliability review found no defects and exact acknowledgement burned `review-6dbafba29dd31629`.
- Status: local implementation verified and reviewed; main push follows this passive record. S06 now has only uncategorized review, not reconciliation-state warnings. Production acceptance pending.


## Historical S07 work unit — 2026-10-06
- User authorized the audited recommendation: fix the obsolete legacy-status test and extend existing temporal comparison with category contributions to selected net expense and current/reference transaction evidence. No new screen or savings/causal advice.
- Prior status simplification delivered and production-confirmed at e183af0c8bbae7470d9b29b770e6fa180ab3e966; this is the branch point and review boundary.
- Branch: feat/period-category-contributions-2026-10-06. Route: delegated direct; multi-file domain/UI/navigation and deterministic tests.
- Reconciled dispositions: S01 duplicate panel declined, existing Comparativa/Deudas covers requested personal/debt view; broad allocation model not implemented. S03 deferred by user because future items are ordinary future-dated transactions, not a separate commitments model.
- Design: disjoint root category signed expense summaries, negated to match selected-net-expense KPI; union both ranges, including uncategorized and zero-net activity. Preserve VOID exclusion, date basis and all financial filters. No parent/child double counting or extra refund/debt sums.
- Drilldowns must intersect the existing category predicate, never replace it with a broader cut. Disable unrepresentable exclude/either intersections with an explanation; both current/reference actions follow the same safety rule. Navigation changes the global period and recalculates comparison, clearly described.
- UI: restrained collapsed category detail inside existing Comparar periodos; reuse components/styles. Remove remaining transaction-state wording in that touched comparator. No private inputs, dependencies or unrelated registry edits.
- Forecast: 200–350 authored lines plus concise tracking; ask-on-risk strategy remains, reassess before commit if over roughly400. Single writer, no artificial line compression.
- Acceptance: contributions sum to existing expense delta; reference-only/current-only/uncategorized/refund/debt/VOID cases; exact or safely disabled category intersections; date and independent-filter retention; accessible responsive disclosure and evidence actions.
- Verification: test-first comparison domain/component/router tests and stale categories regression; synthetic browser existing core smoke; lint, type-check, synthetic test:deployment, diff check, parent focused repeat. No private-data build.
- Earlier checkpoint: audit and parent spotcheck complete; source implementation was pending before the verified implementation recorded below. Preserve .atl modifications.
- Verified implementation: lazy collapsed root contribution cards and both-period evidence navigation; exact/subtree intersections preserved, active exclude/either links explicitly disabled. Legacy status regression and remaining comparator state wording corrected.
- Observed RED: domain3failed/14passed; UI6failed/35passed. Final domain17/17, four UI files42/42, synthetic desktop/390/320 browser3/3, core smoke10/10, lint/type-check/diff exit0, synthetic deployment1/1. Parent repeated domain17/17 and inspected320px screenshot. No private inputs/build or production verification.
- Source/test diff:12files319add16del=335 authored lines; tracking separate, delivery remains below400. Native assessment and main delivery pending.
- S07 work-unit commit:c067c8e (13files352 authored lines including tracking). Native committed assessment:medium, review_due=false, under_budget; no native review approval claimed. Pending slice boundary remains e183af0.
- Local acceptance checks complete; main push follows this passive closure record. User production confirmation remains pending. Rollback is the coherent S07 work unit, not preceding state simplification or registry changes.
