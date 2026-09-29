# Keep the locked vault screen minimal

## Objective and authorized scope

The user requested a lock screen without unlock hints, password-creation advice,
or explanations of the vault/application. Keep the necessary labeled controls,
pending/error announcements and recovery action. Commit and main push are authorized.
The preceding transaction and budget-modal tasks are delivered at `a3a7c70`.

- Simplify the locked, unlocking, error and insecure-context presentations.
- Remove instructional header/footer, security advice, development-empty-password
  hint and explanatory decorative text; preserve a coherent compact visual layout.
- Use neutral short failures without password, publication, transport or Web Crypto
  troubleshooting instructions. Keep error classification and all security behavior.
- Preserve visibility toggle, input clearing, pending/blocked disabling, autofocus,
  secure-context guard, empty-passphrase development support and reload callback.
- No changes to cryptography, transport, vault generation, passphrase policy,
  persistence, auto-lock timing or post-unlock application behavior.
- Existing Spanish UI; technical artifacts in English. No dependencies added.
- Preserve unrelated `.atl` and pcloud task edits. No private inputs, secrets,
  backups or user localhost:5173 access; synthetic isolated verification only.
- Remote: authorized main push through the existing repository origin Git transport.

## Workflow and review boundary

- Branch: `fix/minimal-lock-screen`, based on `a3a7c70`.
- Delegated direct: mapping and implementation span multiple source/test files.
  One writer only; parent owns tracking, commits and native review transitions.
- Strict TDD on from current AGENTS instructions. Runner:
  `pnpm exec vitest run <focused UnlockScreen and app-store test files>`.
- Delivery: retained direct-main / size-exception policy; no PR. Forecast 200–350
  authored lines, depending on obsolete CSS removal. No cosmetic budget shrinking.
- Native RDD remains on. Carry the pending medium T2 slice (399 lines, no review
  due at its commit) from last reviewed boundary `6f28dc9`; do not reset it merely
  because this is a new branch/feature. Assess the next work-unit commit from there.
- Mirror: `odd/minimal-lock-screen/tasks`; prior feature's delivered-commit evidence
  in `odd/tasks/transaction-presentation.md` accompanies this next work unit.

## Task and acceptance

- [x] L1 — Minimal locked/error screen, unchanged unlocking behavior.
  - Remove all explanatory/advisory text, including dynamic error/context hints.
  - Keep form accessible and functional for protected and empty development vaults.
  - Regression tests for generic failures, blocked/pending states, visibility and
    input clearing; no automatic unlock or disabled secure-context guard.
  - Browser at desktop/390/320: minimal screen, generic failed unlock, successful
    unlock, keyboard operation and no overflow; preserve other app regressions.
  - Rollback: UnlockScreen UI/CSS, error-message constants and their tests only.

## Evidence and checks

- Read-only map: AppView routes every non-ready phase to UnlockScreen. Main screen
  and app-store error constants contain the unwanted explanations. No hook or
  cryptographic change is needed.
- Required: observed focused RED/GREEN, full UI, types, lint, diff check; isolated
  browser with screenshots and relevant synthetic Node security contracts.
- Current baseline: UI 365 passed; browser 90 passed/3 device skips; isolated Node
  281 passed/3 optional private-reference skips. Parent will repeat one focused check.
- L1 implemented: compact form, no instructional or decorative copy, generic
  failures and the same unlock/reload callbacks. Store edits are exactly three
  message constants; hooks, cryptography and secure-context guard are unchanged.
- TDD RED: 8 failed/13 passed; GREEN: 21/21. Four App-level assertions initially
  expected removed copy; updating those assertions restored full UI 365/365.
  Initial browser 90 passed/3 viewport skips; Node 281 passed/3 private-data skips.
- A server restart interrupted the writer's final handoff, not the completed
  checks. Independent recovery verification reran focused UI 21/21, full UI 365/365,
  Node 281+3 skips, browser 90+3 skips, all three type checks, lint and diff check.
  It used installed direct CLI equivalents in sanitized source-only snapshots.
  All 552 source/config/test files and modes matched and stayed unchanged; the
  running browser snapshot matched 551 files (its allowlist excludes compose.yaml).
  Evidence: `/tmp/minimal-lock-screen-recovery-_mia0z3v/` manifests and logs.
- Parent spot-check: UnlockScreen 7/7. Desktop/320px locked/error screenshots in
  `/tmp/minimal-lock-screen-visual/` inspected: controls fit, copy is minimal.
  Six total skipped cases are intentional viewport/private-reference checks.
- Obsolete decorative CSS removal exceeds the initial authored-line forecast;
  deletion is part of the requested simplification, not budget-driven formatting.

## Next step

Commit L1 and assess the pending slice from `6f28dc9`; follow exact native
transitions and candidate consent if due before completing the authorized push.
