# Simplify transaction presentation without changing the ledger

## Objective and authorization

Hide VOID transactions, remove the status filter and table column, and make the
budget contribution dialog compact while keeping important transaction data visible.
The user authorized implementation, automatic review, commits and pushes to main.
Debt comparison was delivered separately at `1f1c61d` before this feature.

## Scope and decisions

- Presentation only: preserve original dataset, status metadata, imports, financial
  aggregators, transfer validation and CSV schema. No deletion of source records.
- Ignore obsolete in-memory status selections in effective presentation filters;
  expose active postings to UI. Transactions use active postings for rows, counts,
  pagination and CSV. Remove obsolete status controls/chips/summaries and VOID copy.
- Do not use a nonempty list of active statuses: that incorrectly marks budgets
  as filtered. Do not change historical dataset date bounds or account catalogs.
- Keep source status available only in collapsed technical details, not primary UI.
- Budget rows always show date, payee, category, account, signed contribution amount,
  comment and transfer endpoints. Use the existing verified endpoint resolver with
  the original dataset; never infer from names or combine counterpart contributions.
- Other metadata belongs in native closed details; preserve paging, focus and scroll.
- Spanish UI extends existing copy; code and documentation remain English.
- Preserve unrelated `.atl` registry edits and `odd/tasks/pcloud-cli-env.md`.
- Synthetic verification only; no private backups, `.env` or ledger reads. Leave
  the user's localhost:5173 service untouched. Temporary browser servers are isolated.
- Remote scope: main push to established origin
  `git@github.com:thexenons/myexpenses-analysis.git`, existing Git transport only.

## Workflow

- Base / initial reviewed boundary: `1f1c61d3169d9d7e0ce1bfe821bbf23a0e16201a`.
- Branch: `fix/transaction-presentation`.
- Route: delegated direct for both tasks (mapping over four files, multiple
  non-trivial source/test edits). One writer at a time under current instructions.
- Strict TDD enabled by current AGENTS instructions: observed RED, GREEN, REFACTOR.
  Runner: `pnpm exec vitest run <focused files>`; browser `pnpm test:browser`.
- Native RDD on (global); assess work-unit commits and follow exact native transitions.
- Delivery: retained direct-main / size-exception policy, no PR. Forecast 650–900
  authored lines in two coherent work units including tests and evidence. Size is
  advisory for task splitting: do not compress code or omit tests to meet a number.
- Engram mirror: `odd/transaction-presentation/tasks`. Runtime identity restored;
  mirror the full document and read back after changes.

## Tasks and acceptance

- [x] T1 — Show only active transactions and remove status controls.
  - Ignore stale status selections without mutating original dataset or domain APIs.
  - Remove status filter/chips/count, conditional table status and uniform-status copy.
  - Exclude VOID-only posting facets; preserve account/category catalogs and dates.
  - Verify active states, stale VOID/CLEARED filters, counts, CSV, pagination, budgets,
    insights drilldown and immutable source. Keep collapsed source metadata.
  - Rollback boundary: presentation filters, transaction table/page and related copy/tests.
- [ ] T2 — Compact budget contribution details and show transfer endpoints.
  - Always-visible requested fields; secondary metadata closed and keyboard accessible.
  - Preserve normalized status inside detail, source amounts/currency and split context.
  - Verify categorized transfers, both directions, incomplete links, long/empty comments,
    exact signed contributions, native scrolling, 25-to-27 paging and focus restoration.
  - Rollback boundary: budget page dataset plumbing and contribution dialog/tests.

## Verification and evidence

- Mappings completed read-only by interface_semantics_audit,
  responsive_component_audit and interface_matrix_audit; no source edits at planning.
- Required per task: focused RED/GREEN, relevant browser regressions, types, lint,
  `git diff --check`; final full UI/browser and isolated Node checks.
- Browser baseline: 84 passed, three intentional device skips. Synthetic active
  counts: Real 12 / Yo 13 / Deudas 1. No private data used.
- Node source snapshot must include unchanged tracked compose.yaml and place HOME
  and TMPDIR outside source. Three optional private-reference tests should skip.
- Work-unit commits, authored count and native review outcomes: pending.
- T1 source implementation frozen. RED observed in `/tmp/transaction-t1-red.log`,
  `red2.log` and `red3.log`; focused GREEN 46/46, full UI 363/363. Types, lint and
  diff check passed. Parent inspected active-posting boundary and insights drilldown.
  Browser verification also passed; Node remains deferred until final T2 checks.
- T1 browser RED against old synthetic source: 13 Real rows versus expected 12;
  new count/CSV regression GREEN at 1280/390/320 (3/3). Full isolated browser:
  87 passed, three intentional device skips. Logs `/tmp/transaction-t1-browser-*.log`.
  One initial mobile radio-name locator failure was corrected in the test only.
  Parent hook spot-check passed 5/5; final types/lint/diff checks passed.

## Next step

Commit and assess T1, then implement T2. After both tasks and delivery, begin
the separately requested lock-screen simplification without altering cryptography.
