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
- [x] A03 — Restore keyboard focus after removing global and drawer category chips.
  Delegated writer: two non-trivial UI surfaces and regression tests.
- [x] A04 — Local named filter presets with bounded failure-safe storage and UI.
  Delegated writer: storage/store/UI integration and new tests.
- [x] A06 — Replace the flat category picker with an expandable hierarchy in
  the shared drawer, selecting any node and multiple explicit paths. Delegated
  writer: new narrow UI component and integration/tests.
- [x] A07 — Add accumulated-flow view to Overview and Cash Flow line charts,
  retaining per-period default and selected granularity/global filters. Delegated
  writer: shared derivation and two page integrations/tests.
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

## A01/A02 slice delivery
- A02 work-unit4eaa176; combined range707ec7a..4eaa176 assessed medium/due by
  slice budget (630 lines/17 files). User granted consolidated native review;
  zero findings, exact acknowledgement burned review-a680680abec62a6b.
- Non-force fast-forward/push and remote readback confirmed4eaa176 on main.
  Reviewed boundary now4eaa176. A03/A04/A05 remain pending; .atl files still staged
  for their separately authorized commit, not accidentally included in this slice.

## Accepted category-tree scope (user follow-up)
The existing picker already adds multiple paths, but does not expose hierarchy.
Replace root checkboxes/flat dropdown with a drawer-specific path tree reusing
existing disclosure primitives, not the metric-dependent category-page node.
Expansion and selection independent; any node plus uncategorized leaf selectable.
Keep include/exclude and exact/subtree controls, explicit selected-path states.
In subtree mode parent selection covers descendants; no implicit parent-minus-
child exceptions or misleading inherited checkbox states are introduced.
Tree selection affects the existing shared global filters across every page.
Order now A03 correction -> A06 tree -> A04 presets -> A05 final clean delivery.
Forecast increases to approximately1,200–1,800 authored lines, advisory only.

## Accepted accumulated-flow scope (user follow-up)
Overview and Cash Flow currently show period line values. Add accessible
Por período / Acumulado mode without changing existing period KPIs, bars or
monthly trend. Cumulative curves sum the same filtered time-series minor-unit
values chronologically, preserving zero buckets and day/week/month/year
granularity. Start at the selected/observed interval, not account opening balance
or total wealth; state this visibly. Chart, exact table and CSV must use the same
selected series. Checked integer arithmetic; original inputs not mutated.
No period drilldown currently wired on these line charts; do not introduce one
that labels cumulative values as single-period movements.
Order now A03 -> A06 -> A07 -> A04 -> A05; all remain separately reviewable.

## A03 proof
- Original focus RED 6 fail / 37 pass -> GREEN 43 pass. Independent uncovered
  account reconciliation removing both focused and adjacent chips; correction
  RED 2 fail / 44 pass -> GREEN 46 pass. Resolve actual surviving destination
  after committed update, without stealing external redirected focus.
- Independent and parent two-file UI46pass; isolated browser21pass, zero fail/
  skip at 1280/390/320 in1.7minutes. Direct Cash/Debt cascade -> Expense -> opener
  proof, Enter/Space, drawer selector fallback/Escape and serious axe/overflow.
- Lint/types/diff pass, source stable and cleanup complete. No golden/private
  inputs. A03 commit/native assessment follows; A06/A07/A04/A05 remain pending.

## A03 boundary and A06 proof
- A03 work-unit `6947bee` assessed medium/under_budget (290 authored lines)
  against reviewed boundary `4eaa176`; it remains in the pending review slice.
- A06 hierarchy RED 6 fail / 44 pass -> GREEN 52 UI pass. Restoration RED
  4 fail / 42 pass -> GREEN 46 store pass. Independent and parent combined
  four-file UI/store command: 98 pass, zero failed/skipped.
- Independent isolated synthetic browser: 57 pass, zero failed/skipped across
  1280/390/320, including multi-path selection, reload, keyboard and focus.
  Production synthetic build, lint, all three type configurations and diff pass.
- Parent checked the expanded 320px screenshot and repeated the 98-case command.
  Evidence: /tmp/category-tree-verify.s3WYlF. No private reference inputs read.
- Registry descendants without postings and explicit uncategorized selections
  survive restore without becoming unrestricted. Disclosure and explicit selection
  remain independent; include/exclude and exact/subtree semantics are unchanged.
- A06 authored source/test change is 407 lines, justified by restoration regressions;
  the 400-line planning heuristic does not remove necessary tests or split behavior.
- Rollback boundary: the CategoryFilterTree component, drawer integration, category
  preference reconciliation and associated regression tests, without reverting A03.
- Next: commit A06, assess A03/A06 slice from `4eaa176`, then A07/A04/A05.

## A03/A06 native slice closure
- A06 work-unit `58fff1c`; combined `4eaa176..58fff1c` medium/due,
  693 authored lines / 13 files. User granted this exact consolidated review.
- Native reliability review returned zero findings. Exact acknowledgement burned
  `review-34bbc6810ffc1be9`; reviewed boundary now `58fff1c`.
- Main remains `4eaa176`; final push waits for A07/A04/A05 as requested.

## A07 independent correction scope
- Initial browser verification: 0 pass / 3 fail, all at an ancestor-prefixed
  relative Playwright locator. Correction stays in the existing browser spec.
- Independent synthetic boundary proved safe minor-unit prefix sums can lose
  a cent when converted to floating euros. Accepted optional exact minor-unit
  metadata through chart points, inspector and exact table/CSV, preserving
  existing numeric geometry and fallback formatting for other charts.
- Additional narrow surfaces: shared chart.types.ts, SeriesChart component/tests,
  ChartDataTable component/types/helpers/tests, ChartInspector component/types
  and presentation/utils/format.ts. No dependency or general formatting changes.
- Boundary regression RED observed before correction; independent recheck pending.

## A07 proof
- Accessible per-period default/cumulative mode on both pages derives the same
  filtered, chronological buckets; other KPIs, bars and trend remain unchanged.
- UI RED 4 fail / 12 pass -> GREEN 16 pass. Precision correction RED 5 fail /
  28 pass -> GREEN 34 pass across both pages, SeriesChart and ChartDataTable.
- Positive-only synthetic cumulative domain: six cases passed, including four
  granularities, zeros/gaps/negatives/filtering/immutability/intermediate overflow.
  Parent repeated the same six-case command successfully; no golden bodies run.
- Independent corrected browser: 3 pass, zero failed/skipped at 1280/390/320,
  32 seconds including synthetic production build. Exact table/CSV mode agreement,
  day/month gaps, interval restart and scoped filters passed.
- Concrete 8000000000000001 minor exports 80000000000000.01; eight external
  signed-boundary/zero assertions pass. Metadata preserves exact table/CSV,
  inspector and point titles; numeric geometry remains approximate by design.
- Lint/all three type configurations/diff checks pass, frozen sources stable,
  cleanup complete. Evidence: /tmp/cumulative-flow-correction.ShVG3Z.
- A07 source/test work unit is 583 authored lines across 21 files. Necessary
  precision plumbing and regressions justify exceeding the advisory planning size.
  Rollback boundary: cumulative domain/page modes plus optional exact chart
  metadata and associated tests; unrelated existing period semantics unchanged.
- Next: commit/assess A07 from reviewed boundary58fff1c, then A04/A05.

## A07 native slice closure
- Work-unit `98cfda7`, medium/due from `58fff1c`, 626 authored lines / 22 files.
  User granted native review; reliability returned zero findings.
- Exact acknowledgement burned `review-2943ddd417393cf2`; reviewed boundary
  advances to `98cfda7`. Main push remains deferred until A04/A05 complete.

## A04 accepted integration detail
- Presets include selected granularity alongside the full filter snapshot; applying
  resets dependent invalid amount drafts through the existing reset revision.
- Actual injected resilient storage suppresses quota/read failures and caches raw
  values. Preset-key operations require strict passthrough to expose failures and
  observe latest malformed/future payloads; ordinary preferences stay resilient.
- Added narrow surfaces infrastructure/storage/resilient-app-store-storage.ts and
  its existing test file for strict preset-key behavior and integration regressions.

## A04 proof
- Versioned local-only named snapshots preserve full filters plus granularity;
  apply replaces/reconciles state, and overwrite/delete require confirmation.
- Limits: 20 presets, trimmed/case-insensitive unique names up to 80 characters,
  aggregate 64 KiB UTF-8. Malformed/future/oversized payloads remain untouched;
  quota/read failures visible. Ordinary preference resilience remains unchanged.
- Initial RED 5 behavioral failures / 77 pass plus missing helper. Actual adapter
  RED 2 fail / 2 pass. Final independent and parent four-file Vitest: 101 pass.
- Architecture/runtime boundaries: 5 pass. Lint/all3 typeconfigs/diff pass.
- Independent isolated browser: 6 pass, zero failed/skipped at1280/390/320,
  52 seconds including synthetic production build. Reload, no-match result,
  overwrite/delete/cancel focus, quota/future guards and narrow overflow verified.
- Evidence /tmp/filter-presets-verify.8wt25q, source hash stable, cleanup complete.
  No private/golden bodies, full suites or remote operations used in verification.
- Work unit is 735 source/test authored lines across 14 files: necessary schema,
  limits/storage failure integration and regression tests justify advisory overage.
  Rollback: preset module/store/drawer/strict preset-key adapter/tests only,
  preserving ordinary filter preferences and previous cumulative/tree features.
- Next: commit/assess A04 from98cfda7; then A05 registry/final proof/main clean push.

## A04 native approval and final corrections
- A04 work-unit `5a5f1d2`, medium/due772lines15files, granted reliability review.
  Approved with non-blocking focus advisory; exact acknowledgement burned
  `review-ab3d9b4b90585c45`; reviewed boundary now `5a5f1d2`.
- Full safe Node check:355pass2fail. Architecture requires a CategoryFilterTree
  index.ts and one PascalCase component per TSX file. Both originated in A06.
- Three private test bodies excluded BEFORE execution: official reference figures,
  enriched reference coverage and latest local backup SQLite parity. Excluded
  tests are not counted as runner-skipped; no private files read.
- Independent advisory challenge reproduced async-confirmation BODY focus loss;
  original jsdom disabled-button blur was ineffective. Intentional redirected
  focus remained respected. Native synchronous-browser occurrence not established.
- [x] A08 — Correct category-tree component structure, preserve behavior.
  Delegated writer: component structure/index and focused architecture/UI proof.
- [x] A09 — Correct owned post-commit confirmation focus after async pending blur.
  Delegated writer: drawer logic plus effective deterministic/browser regression.
- A05 remains pending; repeat full checks after these corrections, then registry
  commit and final main delivery. No previous approved review is reopened.

## A08 proof
- Component structure RED2fail5pass -> GREEN7pass; parent repeated GREEN7.
- Tree/drawer UI36pass, lint/all3types/diffpass; no category behavior changed.
- Public index added; hook-free recursive rendering preserves stable disclosure
  keys. Four-file13add13delete, normalization before verification, source frozen.
- Rollback only tree renderer/index and its consumer imports; A09 remains pending.

## A08/A09 correction proof and boundaries
- A08 work-unit `56cb31a`, medium52lines/under_budget from reviewed5a5f1d2.
- A09 async confirmation focus regression RED4fail5pass34skip -> GREEN drawer/
  store95pass; parent repeated95pass. Lint/all3types/diffpass after normalization.
- Recovery after committed settlement requires original focus ownership and open,
  connected drawer; external focus/actions/close/unmount revoke it permanently.
  Success focuses selector; failed writes restore confirmation. Effective tests
  cover BODY loss, delete/overwrite/failure, intentional redirection and revocation.
- Two browser regressions explicitly inject supported async storage, not native
  localStorage async behavior; execution remains pending in full final browser.
- Three-file211add5delete, separate work unit. Rollback only confirmation recovery
  and its regressions. Next commit/assess then repeat A05 full synthetic checks.
