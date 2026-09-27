# Category statistics: completed-period average

**Status:** Implemented, verified, reviewed, and committed in `111fb26e2c1791fe4899419b04344e450deac3c4`. Merge to `main` and push to `origin/main` are authorized and pending delivery. Private-data access remains out of scope.

## Objective

Show a net amount average for each category over fully completed time-series units, without changing the existing filtered totals. This measures activity per period, not per transaction.

## Rules and scope

- The unit is the resolved time-series granularity: day, week, month, or year. Automatic mode uses its resolved unit. A complete January–December range with **month** granularity and a €1,200 category total averages €100/month; year granularity would have one yearly unit.
- Include zero-activity units. A unit contributes to the numerator and divisor only if its entire calendar/accounting interval is inside the effective date range and ended before today. Never project an incomplete unit.
- For open bounds, use the common dataset coverage (on the selected date basis), not each category's first or last posting. Do not pad partial dataset boundary units into complete units.
- Use configured week/month boundaries and the existing filtered-posting, signed-net-amount semantics. The category tree's average must use the same category scope as its displayed total.
- With no complete unit, display `Sin períodos completos`, not zero. Keep the original category total visible.

## Authorized work

Implement the domain calculation, category-tree model and UI, and behavioral tests. No dependency changes or private-data fetches. Delivery is separately authorized only after verification and parent review.

## Tasks

- [x] **T1 — Period calculation and tests.** RED: focused Node test failed on missing feature module. GREEN: nine focused domain tests passed for full-year/month, zero periods, year-to-date, future exclusion, September/week boundary and current week, day/year/automatic units, open coverage, value-date basis, and accounting preferences. Route: delegated writer (domain and UI work span multiple non-trivial files).
- [x] **T2 — Category display and regression checks.** RED: two focused Vitest model assertions failed because averages were absent. GREEN: ten focused UI tests passed, including parent/child totals, null state, selected-category tree scope, and date/granularity recalculation. Route: delegated writer (multiple non-trivial files).

## Acceptance and delivery

- A completed year with month granularity counts all 12 months, including zeros; €1,200 / 12 = €100/month.
- A 2026 year-to-date range ending 2026-09-27 with month granularity uses January–August only, both for sum and divisor.
- A September 2026 range with week granularity excludes boundary-crossing and in-progress weeks from both sum and divisor.
- Category totals remain the original full filtered totals; averages follow filters, granularity, date basis, and period preferences.
- No completed units render the explicit empty state.

**Forecast:** Approximately 350–500 authored changed lines across code, tests, and this document; ~400 lines is advisory, not a reason to remove useful tests or documentation. Delivery strategy: `ask-on-risk`; the user specifically authorized a direct feature-branch commit, merge, and push after verification, with no PR requested. Rollback boundary: only the new average calculation, tree presentation, associated tests, and this task document; existing totals and charts remain untouched.

**Verification:** RED focused tests before production writes; then GREEN focused tests; `pnpm test:node`, `pnpm test:ui`, `pnpm type-check`, `pnpm lint`, `pnpm build`. Runtime harness: N/A; this is a pure local analytics calculation rendered by existing UI, covered by domain and DOM tests.

**Observed closure:** `pnpm test:node` 231 passed, 2 skipped (reference backup not present), 0 failed; `pnpm test:ui` 219 passed across 72 files; `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check` all passed. The first full lint attempt found a test-only `no-map-spread` warning; it was corrected and the final full checks passed. Parent spot-check: all nine domain average tests passed. Commit `111fb26e2c1791fe4899419b04344e450deac3c4` contains both work units, tests, and documentation (401 additions, 10 deletions). Native review assessed medium risk, the user granted review, and the consolidated reliability reviewer reported no findings; exact acknowledgement closed lineage `review-a7da23c96fa2a5df`. The reviewer inspected immutable patches and did not rerun tests. Next: authorized merge/push, followed by the separately requested read-only frontend audit.

**Engram mirror:** Pending (runtime session identity unavailable to this worker; a write was previously reported as `unknown_session`).
