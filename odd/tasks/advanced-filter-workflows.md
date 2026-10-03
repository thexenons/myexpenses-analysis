# Advanced filter workflows and keyboard continuity

## Objective and authorization
Implement account and tag inclusion/exclusion, local named filter presets and
keyboard focus continuity when removing filters. User explicitly authorized
implementation, Conventional Commits and non-force origin/main delivery, then
requested every remaining workspace modification committed and pushed.

## Scope and constraints
- Preserve category filtering and financial aggregation semantics.
- Account exclusion concerns owning account IDs, not transfer endpoints; filtered
  account balances follow the effective account set. Empty selection means all
  in-scope accounts; exclude-all must be representable without implicit reset.
- Tag exclusion negates current any-tag matching; empty selection unrestricted.
- Defaults and legacy preferences remain inclusion. Forward modes in shared
  analytics dependencies, reconciliation and persistence; chips state exclusions.
- Focus removal chooses next/previous surviving chip, then stable opener/selector,
  only when keyboard focus belonged to the removed control. Cover both global
  applied chips and selected category chips in the drawer.
- Named presets are local-only, separately versioned, max 20 presets / 64 KiB
  payload, trimmed names max 80 characters and case-insensitive uniqueness.
  Support save, apply, explicit overwrite and delete. Full state replacement;
  reuse dataset-aware reconciliation, protect numeric cross-dataset identities.
  No export/sharing/sync or automatic overwrite; storage failures visible and safe.
- Existing .atl registry/cache modifications are now explicitly authorized for a
  separate commit. Inspect before delivery; no blind blanket staging.
- No private backup reads, production deployment, dependencies or global installs.
  Avoid reference golden test bodies with positive synthetic test selection.

## Tasks and routes
- [x] A01 — Include/exclude owning accounts, balance/persistence reconciliation,
  drawer controls and explicit chips. Delegated writer: non-trivial multi-file logic.
- [x] A02 — Include/exclude tags with existing split tag semantics and persistence.
  Delegated writer: non-trivial multi-file logic.
- [ ] A03 — Restore keyboard focus after removing global and drawer category chips.
  Delegated writer: two non-trivial UI surfaces and regression tests.
- [ ] A04 — Local named filter presets with bounded failure-safe storage and UI.
  Delegated writer: storage/store/UI integration and new tests.
- [ ] A05 — Commit existing registry changes; complete independent checks, native
  due reviews, chained main delivery and verify a clean worktree/remote ref.
  Parent state/commits plus delegated verification; passive registry structural check.

## Verification and delivery
Each behavior gets deterministic RED/GREEN before implementation when runnable.
Focused synthetic domain/UI/store tests, lint/types and relevant synthetic browser
checks. Final full Node excludes reference golden bodies; full UI and isolated
synthetic deployment/browser checks, reporting omissions honestly.
Normalize before final checks and freeze; no source changes during native review.
Delivery strategy auto-chain / stacked-to-main (existing user preference); forecast
900–1,400 authored lines, advisory only. Independent work units with tests/docs.
Native RDD is on. Assess each commit from last reviewed boundary; medium ranges
under budget accumulate until review due. Relay scoped consent without automatic
grants. Push/merge explicitly authorized. No rewritten history or blanket commits.

## Progress
Exploration complete at main707ec7a. Existing two staged .atl files inspected:
registry paths/source inventory refreshed, cache fingerprint updated, no source
behavior or credentials in their changes. Next: A01 bounded writer.

## A01 proof
- Positive synthetic account domain RED 4 fail -> GREEN 4 pass; focused UI/store/
  hook RED 75 pass / 6 fail -> GREEN 82 pass. Parent repeated four domain cases.
- Independent check found reload pruning valid off-scope inclusion IDs into []
  (default-all). Corrected dataset-valid-ID restore; regression RED 1 fail / 38
  skip -> GREEN store 39 pass. Zero accounts/postings/balances now survive reload.
- First browser run: 19 pass / 2 fail due responsive label locators; corrected
  selectors without changing UI labels. Final entire persistence file 24 pass,
  zero fail/skip at 1280/390/320 in 2.3 minutes, synthetic build successful.
- Lint/types/diff pass; independent four synthetic cases/82 UI pass and source
  stable. No golden reference bodies or private inputs used. Full suites reserved
  for final feature closure. A01 commit/native assessment recorded subsequently.
- A01 work-unit `55085ff` (+383/-14 with initial task record, 397 authored lines)
  assessed medium/under_budget against branch point707ec7a. Native review boundary
  remains707ec7a; the next behavior commit accumulates into this pending slice.
  No native approval claimed. Main delivery will follow the pending slice review.

## A02 proof
- Synthetic tag RED 3 fail -> GREEN 3 pass; focused UI/store/hooks RED 82 pass /
  6 fail -> GREEN 88 pass. Retained logs recovered an interrupted worker without
  discarding edits or inventing RED evidence. Parent repeated three domain cases.
- Independent three synthetic domain/88 UI pass; entire isolated persistence
  browser file 27 pass, zero fail/skip at 1280/390/320 in 2.8 minutes, synthetic
  build succeeded. Tag include selects two inherited split-tag rows; exclude
  complements baseline across reload, search composition and empty selection.
- Central mode uses normalized posting.tags; no additional parent-tag propagation.
  Lint/types/diff pass; source stable, cleanup complete, no private golden bodies.
  A02 commit/native pending slice assessment recorded subsequently.
