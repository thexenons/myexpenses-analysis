# Update dependencies — 2026-10-05

## Objective

Update all project package dependencies and pnpm to the latest stable registry versions, preserving exact pins, reproducibility, current behavior, and private data.

## Problem and scope

Nine of the 32 direct package dependencies and the pinned pnpm manager have newer stable versions. Update their compatible transitive resolution and synchronize active tool-version references. Preserve the existing React Compiler patch, least-privilege build allowances, and release-age protection. Oxlint 1.87.0 additionally requires correcting four render-time current-date reads without disabling its purity rule.

Authorized source surfaces: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `Dockerfile`, `README.md`, `docs/dependency-monitoring.md`, `tests/architecture/dependency-monitoring.test.ts`, `scripts/sync-pcloud/deployment-contract.test.ts`, and new `docs/dependencies-2026-10-05.md`.

D03 compatibility surfaces: new `src/presentation/hooks/use-today.ts` and `src/presentation/hooks/use-today.test.ts`; `src/presentation/components/organisms/PeriodSelector/hooks/PeriodSelector.hooks.ts` and `src/presentation/components/organisms/PeriodSelector/PeriodSelector.test.tsx`; `src/presentation/pages/CategoriesPage/hooks/CategoriesPage.hooks.ts` and `src/presentation/pages/CategoriesPage/CategoriesPage.test.tsx`; `src/presentation/pages/CashFlowPage/CashFlowPage.savings-trend.tsx` and `src/presentation/pages/CashFlowPage/CashFlowPage.test.tsx`; `src/presentation/pages/BudgetsPage/hooks/BudgetsPage.hooks.ts` and `src/presentation/pages/BudgetsPage/hooks/BudgetsPage.hooks.test.tsx`.

Historical dated reports and unrelated source code remain unchanged. No private inputs, deployment, or global tool installation. The user explicitly authorized committing the scoped update, integrating it into main, and pushing origin/main using configured Git authentication. No other remote access or credential discovery is authorized.

## Delivery and routing

- Branch: `chore/update-dependencies-2026-10-05`.
- Base: `abdf9e8e7b1ca80c69f8b32376888e2ffacb4b4a`.
- Strategy: `ask-on-risk`; initial forecast about 180 authored added/deleted lines, excluding generated lockfile. Observed final scope is about 388 authored lines plus generated lockfile; one coherent compatible dependency-update work unit is authorized for direct main delivery.
- D01 route: delegated direct; reading prepares a multi-file dependency/tooling update.
- D02 route: delegated verification plus parent structural/command spot check; integrated suites exceed inline evidence budget.
- D03 route: delegated direct; four mapped date-sensitive call sites require one tested shared clock boundary.
- RDD: initially on (global); terminal preflight returned `stop/rdd_disabled`, and final mode readback confirmed global off. No agent toggle, review START, candidate consent, approval, commit or push. Delivery is `disabled/unmanaged`.

## Tasks and acceptance

- [x] **D01 — Update stable dependency and manager pins.** Updated nine package pins and pnpm 12.6.0 → 12.9.1, regenerated lockfile, synchronized active references and contract tests, and added dated snapshot. Focused RED: 7 passed, 2 old-pin failures; GREEN: 9 passed. Frozen strict-peer install passed; all 32 direct pins plus manager match latest, outdated `{}`, audit zero advisories. Compiler patch hash retained. Commit: pending explicit authorization.
- [x] **D02 — Verify integrated behavior and close evidence.** Frozen strict-peer install, final lint, three TypeScript projects, safe Node, full UI coverage, synthetic production build, outdated/audit and final diff check passed. Browser smoke was attempted but all six selected bodies were unavailable due missing `libnspr4.so`; this is an explicit remaining verification gap, not a pass. Native preflight stopped with `rdd_disabled`, confirmed global off, so no review was started. High/unassessable initial assessment used conservative independent verification, which passed final Node/types/UI/build checks. Commit: pending explicit authorization.
- [x] **D03 — Restore lint compatibility with pure date snapshots.** Added shared `useToday`, replaced four impure date reads, and retained timezone changes, midnight rollover and subscription cleanup. Genuine savings-midnight regression RED then focused GREEN: 43 tests / 5 files. Final lint and all three TypeScript projects passed; safe Node: 357 passed; UI coverage: 593 tests / 94 files passed; synthetic production pipeline: 1 passed. No purity-rule suppression or private inputs. Commit: pending explicit authorization.

## Required checks

- New pnpm selection uses a temporary/npm cache installation, not a global update.
- `pnpm install --frozen-lockfile --strict-peer-dependencies` under pnpm 12.9.1.
- `pnpm lint` and `pnpm type-check`.
- `pnpm exec node --import tsx --test --test-skip-pattern='^(reference backup dataset reproduces the official MyExpenses figures|matches the enriched-data coverage of the reference backup|latest local backup agrees with independent SQLite financial queries)$' "scripts/**/*.test.ts" "tests/domain/**/*.test.ts" "tests/architecture/**/*.test.ts"`.
- `pnpm test:ui:coverage` (includes all UI tests; retain existing thresholds).
- `pnpm test:deployment` (real production build with isolated synthetic inputs; never run bare `pnpm build`).
- `pnpm exec tsx tests/browser/run-isolated.ts --project=desktop --project=mobile-390 --grep="unlocks a synthetic vault|keeps VOID out of scoped transaction counts|explains linear budget allowance"`.
- `pnpm outdated --json`, `pnpm audit --json`, and `git diff --check`.

## Progress and next step

D01 completed. All 32 direct dependencies and pnpm match stable registry tags; nine packages updated. Removed five stale release-age exemptions and added 22 exact fresh-version exceptions (three direct releases plus 19 Oxlint platform bindings), preserving the 24-hour gate and esbuild-only builds.

D02 partial evidence: strict peers, three TypeScript projects and 357 safe Node tests passed. Exactly three private test bodies excluded before execution (not counted as Node skips). UI coverage: 585 tests / 93 files passed; statements 87.01%, branches 78.30%, functions 91.32%, lines 91.48%, thresholds unchanged. Synthetic deployment/real production build: one test passed. Browser smoke: six selected scenarios could not start Chromium because `libnspr4.so` is missing; no system packages installed. New lint failed four `react(purity)` diagnostics on unchanged date-reading source; old Oxlint 1.85.0 passed the exact flags, proving update-caused enforcement change. Sandbox UI/deployment/IPC failures required one escalated retry each; UI and deployment then passed. `git diff --check` passed.

Final D03 evidence: lint passed, including parent command spot check; all three TypeScript projects and 357 safe Node tests passed. Full UI coverage passed with 593 tests / 94 files, statements 87.07%, branches 78.38%, functions 91.36%, lines 91.51%, existing thresholds unchanged. Synthetic deployment/actual production build passed one test. These final checks cover the corrected bytes, not merely the earlier dependency-only state. Browser remains unavailable due missing `libnspr4.so`; no retry or system package installation. Audit/outdated evidence remains applicable because the dependency graph did not change during D03.

Some wrapped checks were interrupted awaiting approval without returned execution proof; they are not counted as passes. Fresh verifier used plain direct commands and concrete tracked Node test paths, obtaining observed exits with no approval blockers.

Closure: dependency update and available functional checks completed. Native selectorless STATUS initially failed due sandbox read-only internal files; one approved escalation returned terminal `stop/rdd_disabled`. Final mode status confirmed global off; native review did not start, and no approval is claimed. Initial assessment was high/unassessable because of undeclared untracked files; it did not lower the verification tier. Independent final verifier and parent lint/diff spot checks passed.

Remaining gap: browser smoke requires its missing system library; no system installation or blind retry. User confirmation authorizes local commit, fast-forward main integration, and non-force origin/main push. Delivery is in progress; record observed commit and push evidence after execution. The subsequent statistical audit is read-only and does not authorize further source changes.

Engram mirror: `odd/update-dependencies-2026-10-05/tasks`; synchronize after each observed task result.
