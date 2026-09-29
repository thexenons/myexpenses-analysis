# Keep period labels and dates inside their controls

## Objective and scope

Fix the compact period selector on mobile and desktop without changing filtering
behavior or hiding overflowing content. The user explicitly authorized the fix,
commits, integration into `main`, and push to the configured GitHub origin.

The previous Chromium investigation found labels intersecting the mobile pill's
curved border (`999px` radius on a tall stacked control), and custom date inputs
compressed to 55–65px on desktop. Rectangular overflow checks miss the curved
border problem. Preserve the existing visual language with a bounded radius and
enough width or wrapping for complete date values.

## Constraints and delivery

- Change only selector styles, focused browser regressions, and this record.
  Preserve filter logic, labels, focus visibility, dependencies and unrelated edits.
- Use the existing isolated synthetic browser harness; never read real `.env`,
  backups or credentials, and never run live synchronization or deployment.
- Base: `a12e3004cec2b3813fb1aaa73b1df97412584491`.
- Feature branch: `fix/period-selector-layout`; deliver to `origin/main` using
  the already-authorized configured GitHub SSH transport. No force push or PR.
- Route: delegated direct. Prior mapping covered more than four files;
  preparation and writing involve CSS plus a non-trivial browser regression.
- TDD: enabled by the user's earlier explicit session choice. Runner:
  `MYEXPENSES_BROWSER_RUNTIME_LIB_DIR=/tmp/saracastello-browser-libs.hDbDUm/root/usr/lib/x86_64-linux-gnu pnpm test:browser --grep 'period selector'`.
- RDD: on, source global. Assess the work-unit commit against the base above;
  candidate consent and native transitions remain separate from implementation.
- Delivery strategy: `ask-on-risk`; forecast 160–240 authored changed lines,
  including this document. Work-unit authored count: 190 (+184/-6).
  This evidence-only follow-up remains within the forecast; no chain needed.
- Rollback boundary: selector CSS, associated browser regression additions and
  this recovery record; unrelated pCloud work and user registry edits excluded.
- Engram mirror `odd/period-selector-layout/tasks`: pending. Runtime identity
  is unavailable; the host explicitly prohibits agent-attributed memory calls
  until registration is restored. Preserve the full local document meanwhile.

## Task

- [x] T1 — Fix compact selector geometry with browser regression coverage.
  - Route: delegated writer; triggers and scope recorded above.
  - Observe RED for label containment within rounded corners and intrinsic date
    readability before changing production styles, then GREEN and refactor.
  - Cover all six period modes at 320/390px and 1024/1280px, including custom
    ranges. Labels and full date values remain visible without page overflow.
  - Preserve control interactions and visible focus; do not use overflow hiding.
  - Inspect desktop/mobile screenshots. Run focused and full isolated browser
    suites, UI tests, type-check, lint, and `git diff --check`.
  - Record failed, skipped or unavailable checks, the work-unit commit and native
    assessment outcome before integration and push.

## Progress and evidence

- The task record preceded all implementation writes. Reused the previous
  read-only reproduction, isolated harness and existing Chromium runtime libs.
- Compact radius is now `--radius-md` with more internal padding. Flex bases
  allow controls to wrap instead of crushing native date values; custom dates
  use an adaptive grid. The compact decorative arrow is hidden so it cannot
  become an orphan grid item. No filtering logic or dependencies changed.
- RED: focused Chromium regressions failed 3/6 before production CSS changes:
  desktop controls were narrower than their native content, and labels crossed
  the curved border at 390/320px. Log: `/tmp/myexpenses-period-selector-red.log`.
- GREEN: focused regressions passed 6/6 after CSS changes; final rerun also
  passed 6/6 (24.9s), including all six modes at 1280/1024/390/320px. It checks
  rounded-border text containment, native control width, keyboard focus, custom
  date editing and document overflow. Log: `/tmp/myexpenses-period-selector-final.log`.
  A temporary wrapper ran the same isolated harness and preserved standard
  `testInfo.outputPath` screenshots before cleanup; no wrapper was committed.
- Full `pnpm test:browser` with the runtime-lib environment above: 63 passed,
  zero failed, 3 intentionally skipped (mobile touch on desktop; desktop hover
  on both mobile projects), 3.9m. Log: `/tmp/period-selector-browser-full.log`.
  This run preceded only the final screenshot-path/blur cleanup; the final
  focused rerun includes that cleanup. The production CSS was unchanged.
- Final `pnpm test:ui`: 81 files, 304/304 tests passed.
  Log: `/tmp/period-selector-ui-final.log`. `pnpm type-check`, `pnpm lint`, and
  `git diff --check` passed. No production build against private data was run;
  browser verification used only the existing isolated synthetic app harness.
- Parent inspected cropped selector and full-page screenshots at 1280/1024/320
  plus the 390px selector; writer inspected all four full-page captures. Labels
  and dates are readable, focus remains visible, sibling controls wrap normally.
  Screenshots: `/tmp/myexpenses-period-selector-final-artifacts/` (not committed).
- An intermediate screenshot rerun could not start because the parent's browser
  suite held port 41789; no server was reused or changed. Serial rerun passed.
- Firefox/WebKit and live/private datasets were not tested. Node/deployment suites
  were not rerun for this CSS/browser-test-only change; worker/CLI are untouched.
- Implementation/test diff: 98 authored changed lines (+92/-6), plus this record.
- Work-unit commit: `c47c48647998feae8bc441a17af06e10bd4ed6ad`
  (`fix(filters): keep period labels and dates inside controls`).
- Native committed-only assessment against `a12e300`: medium (`executable_change`),
  3 paths / 190 authored lines, `review_due: false`, reason `under_budget`.
  No reviewer was invoked and no approval receipt is claimed. The slice remains
  under budget against the same base for this evidence-only follow-up.
- Delivery verified: fast-forwarded `main`, then pushed `origin/main` using the
  configured authorized GitHub SSH transport. Both refs resolved to `c47c486`
  after successful push (`a12e300..c47c486`). No force push or PR. Existing
  `.atl` changes and the pCloud task-record update were preserved and excluded.

## Next step

No implementation work remains. Engram mirroring is still pending host session
registration; do not invent an identity or retry agent-attributed calls meanwhile.
