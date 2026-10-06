# S06: Overview review cautions audit

## Selected evidence

- `OverviewPage.helpers.ts` already consumes the shared filtered dataset. Count
  active postings directly in one pass; do not recompute analytics per signal.
- Missing categories: empty category path, expense/income bucket, no transfer
  link. Refunds remain eligible; transfer buckets and linked debt mirrors do not.
- Unreconciled: recorded `UNRECONCILED` status, not an inferred accounting error.
  Split parts count as postings. VOID is excluded from both populations.
- Positive counts sort by volume descending, then stable ID. This is not risk
  scoring; overlapping counts are not a unique total.

## Corrected assumptions and drilldown contract

`v189/adapter.ts` retains NEUTRAL category types for unmapped expense/income
postings; `normalize-backup-dataset.ts` preserves type and bucket separately.
Its validation prohibits NEUTRAL transfer buckets. EXPENSE/INCOME-only filters
would miss eligible rows. The action intersects the current type restriction
with EXPENSE/INCOME/NEUTRAL; empty intersections never become unconstrained.

`useFilteredAnalytics` deliberately ignores table-only status filters in
statistics, as do existing Insights identity actions. Cautions use exactly the
Overview active population, not a different hidden-status selection. Navigation
replaces retained table status with the three active statuses for missing
categories, or UNRECONCILED for its signal. It never admits VOID.

All independent financial filters and granularity remain untouched. A visible
missing-category signal proves unlinked empty paths pass the original category
predicate, including exclude/either modes; replacing that predicate cannot add
another category or transfer peer. Actions are unavailable while deferred search
is pending. Native buttons navigate to page 1, date descending in Transacciones.

## Resolved target-table root cause

Browser evidence exposed that Transactions also consumed the status-neutral
shared hook: an UNRECONCILED action selected one evidence row but showed two.
The approved root fix adds an opt-in `respectStatuses` mode for Transactions;
default statistics still ignore retained table statuses and exclude VOID.
Pagination, rows, summary and full CSV all consume the same active target cut.
The bounded two-entry cache keys include effective status-array identity, so
status-aware and default results cannot cross-contaminate. Empty selections
use one shared constant in both modes; repeated equivalent consumers reuse a
single derivation. Regression tests exercise mode changes, status changes,
shared consumers, source immutability and VOID exclusion.

## Deferred signals and risks

- Raw empty-category aggregates also include legitimate transfers: unsafe oracle.
- Budget health uses budget-local periods and suppresses partial comparisons;
  budget pace is not an end-period prediction. No budget alarm is added.
- Category averages and payee frequencies do not establish anomalies.
- The raw value-date quality API accepts VOID rows, but the live Insights hook
  projects active rows. Do not infer a live UI denominator mismatch from the
  raw API alone; defer consolidation until a shared effective-cut contract exists.
- No selected signals is not certification. No active data is a distinct state.
  Observed intervals never certify complete history or unrecorded activity.

## Acceptance and performance

Pure tests compare drilldown posting IDs with selected evidence, including
NEUTRAL, restrictive types, categories, dates/basis, scope and content filters.
View tests cover deterministic ordering, empty states, keyboard activation and
pending protection. An isolated browser vault leaves shared fixture amounts
unchanged and exercises both actions across desktop, 390px and 320px viewports.
No domain calculations, router definitions, dependencies or private inputs change.
One O(n) active-row pass and two-item sorting are the only added derivation.
