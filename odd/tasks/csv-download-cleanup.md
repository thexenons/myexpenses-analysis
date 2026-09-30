# Release CSV download resources on browser failures

## Final status

C1 committed as `cf698a9`, fast-forwarded and pushed to `origin/main` successfully.
No implementation or delivery work remains for this task; unrelated local edits
were preserved. Memory synchronization remains pending runtime registration.

## Scope and evidence

The user authorized continued technical improvements, delivered as small successive
tasks to `main` with a push after each task. A synthetic failure-injection probe
showed that throwing from the CSV anchor's `click()` leaves the hidden anchor and
Blob URL allocated. Cleanup currently runs only on the successful path.

Fix only the download resource lifecycle. Preserve CSV bytes, filename, transaction
selection, security escaping, domain calculations and normal download behavior.
Do not swallow browser exceptions. No private data, environment files, credentials,
live deployment or user localhost:5173 access. Preserve unrelated workspace edits.

## Task and acceptance

- [x] C1 — Run anchor cleanup and revoke its object URL after
  download setup/dispatch, including thrown browser-boundary failures. Add a
  success-path test and failure-injection regressions. Verify original failure
  propagation when cleanup succeeds and no accumulated resources across attempts.

## Route and delivery

- Delegated direct: implementation and regression tests require coordinated edits.
  One writer; parent owns task tracking, commits, review and delivery.
- Strict TDD is enabled by project AGENTS: observed RED, then GREEN and refactor.
- Test runner: installed Vitest (`node node_modules/vitest/vitest.mjs run`).
- Base/review boundary: `2f233a7`; branch: `fix/csv-download-cleanup`.
- Forecast: roughly 120–200 authored lines including tests and this document.
- Delivery: `auto-chain`, `stacked-to-main`; commit, integrate and push C1 after
  its applicable checks. Native review remains governed by candidate assessment.
- Engram mirror pending: runtime has no authoritative registered session identity;
  agent-attributed memory writes are prohibited. This file is the recovery record.

## Verification and rollback

Focused helper tests must demonstrate failure before the fix and pass afterward.
Run full UI, all three TypeScript projects, Oxlint and whitespace checks. Parent
repeats the focused test. Exercise actual synthetic browser CSV download using the
existing isolated harness; never run the full Node suite against private inputs.
Rollback boundary: TransactionsPage download helper and its focused regressions.

## Progress

Exploration complete. No reproduced defect in app-store cancellation/stale response
handling or storage fallback (28 lifecycle and 22 boundary tests passed in focused
audit runs). C1 is the only selected change.

C1 now uses `try/finally` around anchor setup/dispatch, with independent URL
revocation if anchor removal itself throws. CSV bytes, BOM, MIME, filename and
normal timing are unchanged; browser errors are not swallowed. Source/test delta:
121 authored lines. Valid RED: focused 7/10, three cleanup failures. Final GREEN:
- Focused helpers: 10/10, independently repeated by the parent.
- Full UI: 375/375 across 84 files; three TypeScript configurations and Oxlint
  (zero warnings/errors) passed, as did whitespace checks.
- Isolated browser CSV tests: 3/3 across desktop/390px/320px, with nine actual
  downloads; Real/Yo/Deudas preserve 12/13/1 rows and exclude VOID.
  Command: `node node_modules/tsx/dist/cli.mjs tests/browser/run-isolated.ts --grep
  'keeps VOID out of scoped transaction counts, rows and CSV without changing its schema'`.

Evidence: `/tmp/csv-c1-red-1c4EH5/`, `/tmp/csv-c1-final-focused-4RxqkK/`,
`/tmp/csv-c1-full-ui-GY3CY7/`, `/tmp/csv-c1-final-checks-S2rSIY/` and
`/tmp/c1v-mzre8uao/` (commands, results and before/after manifests).
Browser source-manifest SHA-256:
`f501a6dbce26023846a26e007f26279f9cac865b57771ddf0163489576fe7798`.
Source/index/status and protected user edits remained unchanged during verification.
Limits: full Node/build and full browser suite were not run; browser checks do not
assert the filename or subscribe to `pageerror` (filename is covered by unit tests).
Intermediate test typing/lint issues were fixed before final successful runs.
Assessment of `cf698a9` against `2f233a7`: medium, 191 authored changed lines,
`review_due: false`, `under_budget`. Native review is deferred by the configured
policy; no approval is claimed, and the reviewed boundary remains `2f233a7`.
The authorized main push succeeded and local/remote-tracking tips matched `cf698a9`.
Future iterations should accumulate review scope from the same reviewed boundary
until native assessment requires review. Memory mirror remains pending.
