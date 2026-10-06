# Deliver statistical audit improvements

## Objective
Implement the accepted statistics recommendations in priority order, delivering each completed task to main before checking it in production and starting the next task.

## Problem and why
The application has substantial descriptive analytics, but monthly orientation, interpretation safeguards, person responsibility and forward planning remain uneven. The source audit is `docs/audit-statistics-20261005.md`. Priority is not a claim that every finding is a calculation bug.

## Approved order and scope
The user accepted this order on 2026-10-06:
S05 -> S02 (clarification) -> S04 (transparency) -> S01 -> S06 -> S03 -> S07.

- Start with S05. Later task implementation waits for the preceding main delivery and production-check boundary.
- S02 initially reinforces the existing scenario explanation; a new forecasting engine is outside that slice.
- S04 initially exposes unverified coverage; a model certifying complete history needs a separate design decision.
- S01 needs explicit payer/responsible/beneficiary and unassigned-share definitions before implementation.
- No unrelated changes, private financial inputs, dependency upgrades, history rewriting or automatic review-mode changes.
- Preserve existing changes to `.atl/skill-registry.md` and `.atl/.skill-registry.cache.json`.
- Technical artifacts use English; user-facing selector copy follows the existing Spanish interface (for example, Mes actual).

## Delivery and routing
- Current task branch: `feat/statistics-current-month-2026-10-06`.
- Branch point / initial reviewed boundary: `238e1d69ca8155dc2ee4d982d603b0c6fad67d97`.
- Each task closes with a scoped Conventional Commit containing behavior, tests and relevant documentation.
- Integrate each verified task into main and push main without force, as explicitly requested.
- Use the repository's configured Git authentication previously confirmed for origin/main; do not discover or reuse ambient SSH agents, remote sessions or deployment credentials.
- Main pushes run repository CI. Local deployment documentation describes Coolify/main but supplies no verified public production URL.
- Record push and production outcomes separately: a push or local build does not prove successful deployment.
- Delivery strategy: `ask-on-risk`; no PR or chain is currently planned because delivery is per-task main integration.
- Forecast: S05 source/tests approximately 50–100 authored lines, plus this tracking document and CI smoke inclusion. Whole-roadmap forecast is unresolved until structural product scopes are defined; do not treat it as zero. Reassess before any delivery unit exceeds approximately 400 authored changed lines.
- S05 work-unit authored count: 299 lines (296 additions, 3 deletions), including this roadmap; below the 400-line planning heuristic. Passive closure documentation is recorded separately.
- RDD read on 2026-10-06: on, decided by global. Preserve candidate consent and provider-issued lifecycle commands.
- S05 route: delegated direct. Shared hook/view/types, behavioral tests and browser/CI surfaces trigger bounded writer delegation.
- Remaining tasks: delegated direct anticipated; derive exact edit surfaces and applicable checks before each task rather than granting blanket source authority.

## Task checklist

### 1. S05 — Add explicit current-month access
- [x] Integrate Mes actual subtly in the shared PeriodSelector; visual correction verified locally, pending production acceptance.
- Reuse the existing timezone-aware today, calendar helper and date-period action.
- Current-month selection is month-to-date, following the existing calendar convention.
- Change only period mode and date range; retain scope, date basis, search, other filters and aggregation granularity.
- Fresh/reset state remains all-history; restored selections are not changed on load. Explicit activation persists like existing filter changes.
- Acceptance: one action selects the current month, keyboard activation works, other filters survive, all-history remains accessible, and deliberate selection survives reload.
- Required proof: observed component RED -> GREEN -> REFACTOR; focused component tests; synthetic isolated browser checks on desktop/mobile; lint, all TypeScript projects, build and diff checks.
- Include the new synthetic scenario in push-time CI smoke without weakening existing cases.
- Final local proof: component RED observed, GREEN 23/23; focused three-viewport browser 3/3; updated desktop/mobile CI smoke 8/8; lint/all three TypeScript projects/diff check passed; synthetic deployment 1/1 exercises actual tsc/Vite production builds. Private-data build remains unavailable and is not claimed passed. Work-unit commit: `dad3662217924c53392e59ad2066928eda9d41d4`. Native review: approved and acknowledged. Delivery target: `origin/main`; production check remains pending.

### 2. S02 — Reinforce scenario interpretation
- [ ] Distinguish the budget-compliance annual scenario from observed overspend and actual money remaining.
- Preserve existing scenario calculations and their documented assumptions.
- Acceptance: the user can identify what is actual versus conditional without implying a spend-sensitive forecast.
- Checks: relevant scenario domain/component/browser regressions; no silent arithmetic-policy changes.
- Commit / review / main push / production check: pending.

### 3. S04 — Expose coverage uncertainty
- [ ] Consistently identify observed versus verified coverage and distinguish absent data from evidenced zero activity.
- Begin with honest unverified/unknown state, not automatic certification from date endpoints.
- Acceptance: incomplete or unverified inputs do not acquire unsupported completeness claims.
- Checks: synthetic sparse-history and empty-period cases plus affected summary/scenario UI.
- Commit / review / main push / production check: pending.

### 4. S01 — Attribute expense responsibility explicitly
- [ ] Define roles, stable person identities, assignments and unassigned shares, then implement the accepted model.
- Do not equate payee/account ownership with responsibility or silently infer assignments.
- Acceptance: allocations reconcile to each posting/split total without double-counting debt or transfers.
- Checks: focused allocation/domain fixtures, import compatibility, persistence and relevant UI flows.
- Product definitions and exact model/edit scope: pending.
- Commit / review / main push / production check: pending.

### 5. S06 — Consolidate evidenced cautions
- [ ] Present existing supported signals in a prioritized view with dates, active filters, explanation and detail links.
- Do not present linear budget allowance as a spending forecast.
- Acceptance: every caution is traceable; priority rules and data limitations are visible.
- Checks: deterministic ranking, filtered/insufficient-data scenarios and keyboard/mobile navigation.
- Commit / review / main push / production check: pending.

### 6. S03 — Model confirmed future commitments
- [ ] Define and implement confirmed due dates, recurrence, remaining amounts and payment reconciliation.
- Keep inferred patterns separate from accepted obligations; do not double-count recorded payments.
- Acceptance: confirmed upcoming commitments can be understood and reconciled in the supported planning scope.
- Checks: recurrence/date boundaries, partial/complete payments, duplicate prevention and persistence.
- Product definitions and data-source scope: pending; S03 is not a technical prerequisite for S01.
- Commit / review / main push / production check: pending.

### 7. S07 — Add evidence-linked actionable reviews
- [ ] Offer concrete reviews supported by available data, with assumptions and measurable outcomes where justified.
- Avoid unsupported causal claims or quantified savings promises.
- Acceptance: recommendations link to evidence and communicate uncertainty or missing history.
- Checks: sufficient/insufficient evidence, filter context, explanatory links and relevant UI regressions.
- Commit / review / main push / production check: pending.

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

## Progress and next step
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

## Rollback boundary
S05 changes only the shared period selector, its focused tests and the added CI smoke scenario. Revert that coherent work unit without reverting prior financial features or unrelated local changes.

## S05 visual correction — reopened 2026-10-06
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
