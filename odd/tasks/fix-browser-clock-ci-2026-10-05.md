# Repair browser CI clock synchronization

## Objective
Restore deterministic financial-explainability browser checks without changing financial calculations or weakening assertions. Preserve the completed statistics audit for later product decisions.

## Problem and evidence
The fixture mounts the application at 27 September, then four tests change the fixed date after mounting. The state-based calendar hook does not refresh on arbitrary rerenders. The exact CI smoke reproduced 4 passes and 2 failures: the August consumption window ended on the 31st instead of the 23rd. The workflow command itself is valid.

## Authorized scope and constraints
- CI test repair requested explicitly after the audit; statistical recommendations remain unaccepted.
- Source edit surface: `tests/browser/financial-explainability.spec.ts` only.
- Documentation: this task record and `docs/audit-statistics-20261005.md`.
- Keep all financial assertions, privacy isolation, network blocking and production clock behavior unchanged.
- No private inputs, system installations, ambient remote sessions or history rewriting.
- Dependency delivery already completed on main at `c009eccd611c6d4d8a1f8096ec9ff56b1d428456`.

## Routing and delivery
- Branch: `fix/browser-clock-ci-2026-10-05`; base: `c009eccd611c6d4d8a1f8096ec9ff56b1d428456`.
- Route: delegated direct; unfamiliar test-fixture preparation and command execution require delegation.
- One writer, then risk-selected independent verification. RDD is globally off; no native review is started.
- Delivery strategy: ask-on-risk; forecast approximately 350 authored changed lines including the full audit report and tracking, generated files excluded. No PR is planned.
- Work-unit commit follows verified completion; the user's explicit main merge/push request supplies Git delivery authority using the already confirmed configured Git authentication. The earlier dependency delivery remains recorded separately.

## Tasks
- [x] C01 — Deterministically synchronized the supported refresh boundary; inspected all four late clock changes, retained their expected outcomes, and completed the exact CI smoke, affected cases, lint, TypeScript and diff checks. Work-unit commit: `d1f21c4ead01a7ad8281b36fc0182581fbc13852`.

## Acceptance criteria and verification
- RED already observed by the diagnostic worker: desktop/mobile linear allowance fails at the unchanged 23-August assertion; 4 passed, 2 failed, exit 1.
- Exact smoke: `pnpm exec tsx tests/browser/run-isolated.ts --project=desktop --project=mobile-390 --grep="unlocks a synthetic vault|keeps VOID out of scoped transaction counts|explains linear budget allowance"`.
- Run every affected clock-sensitive scenario on desktop, mobile-390 and narrow-320; use only the existing synthetic isolated server and temporary runtime-library mechanism.
- Run project lint and all existing TypeScript checks. Tests are required to reach assertions, not merely list or launch.
- Parent re-runs one reported command before delivery. Risk assessment failure is high/unassessable and requires an independent verifier in addition to writer checks.
- Final source-mutating normalization precedes functional checks; no arbitrary sleeps, assertion relaxation or production-hook changes.
- Audit report and full Engram mirror retain S01–S07, nine areas, exact audit evidence and pending recommendations.

## Progress
- Statistics audit completed before CI implementation; report structurally verified and mirrored in Engram observation 2986.
- CI diagnosis complete. Existing temporary Chromium libraries permit assertion-level reproduction without system changes.
- Source: test-only `setAppTime` dispatches the supported focus refresh after a fixed-clock change in two non-reloading tests; the two other scenarios already reload and remain unchanged. All assertions and production code are unchanged.
- GREEN: exact CI smoke 6 passed, exit 0, 25.3s (parent spot check); independent three-width allowance/glyph/annual checks 9 passed, 39.7s; three financial scopes of budget history across three widths 9 passed, 58.4s. All used synthetic isolated inputs.
- Writer lint and all three TypeScript projects passed; independent diff check passed. Earlier old-runtime writer IPC denial produced no assertion-level proof; current-runtime parent and independent runs supersede that environmental attempt.
- Assessment: high/unassessable because untracked documents were undeclared; conservatively completed independent verification, no actionable findings. RDD off/unmanaged; no native review or consent was started.
- Full unrelated suites were not repeated for this test-only edit. Remote CI status has not been inspected.
- Audit commit: `35e94960e0e43a7b12b543eff75dceb7a3bb5a7e`; CI work-unit commit: `d1f21c4ead01a7ad8281b36fc0182581fbc13852`.
- Authored delivery count before passive closure: 323 additions plus deletions, no generated files; below the 400-line planning heuristic. No PR or chaining required.
- Main was fast-forwarded and pushed to origin without force. Direct `ls-remote` confirmed remote main and local HEAD both equal `d1f21c4ead01a7ad8281b36fc0182581fbc13852` after that delivery.
- This final passive closure records observed delivery; it introduces no source or functional changes.

## Rollback boundary
Only the financial-explainability fixture/date setup is changed; revert that test edit independently of the statistical audit report and prior dependency update.

## Next step
Observe the remote CI run when access is explicitly authorized, then consider S01–S07 with the user. Do not implement statistical recommendations without authorization.
