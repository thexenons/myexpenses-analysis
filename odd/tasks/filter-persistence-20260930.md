# Restore valid global filters after reload

## Objective and authority

Persist global filter preferences in localStorage so reloading does not clear
them. Restore only supported criteria available in the successfully loaded
dataset. The user explicitly authorized autonomous implementation, commits and
main push immediately after UI clarity delivery; that prerequisite is complete.

Feature ID: `filter-persistence-20260930`. Branch:
`feat/filter-persistence-20260930`, starting main `4a019df` (UI clarity closed).
All feature commits use `[filter-persistence-20260930]`, separate from the
`[ui-clarity-20260930]` rollback group. Conventional Commits; no AI attribution.

## Exploration and design

The existing Zustand app-store storage boundary persists granularity only.
Lock/reload clear live filters intentionally; persisting the live filters
unconditionally would overwrite saved preferences with defaults. Keep a separate
filter-only preference snapshot and apply it only after successful analytics
loading, not while locked or during failed unlock. Reset stores default filters.

Reuse existing resilient storage and `restoreFilterState` validation. Persist a
small versioned allowlisted shape, never the store/dataset wholesale. Prune
against full loaded analytics, not options narrowed by other active filters.
Filter selections must not cause one another to disappear during restoration.

Accounts/endpoints use normalized account UUIDs, not numeric database row IDs.
Category paths/tags are semantic name paths/names; reconcile with currently
available options. Payee/payment-method keys can contain dataset-local numeric
IDs: bind those to the exact source database hash and discard them when that
binding changes or cannot be trusted. Preserve stable available criteria and
valid custom date ranges, even if intentionally empty; reject invalid dates or
reversed intervals through existing validation. Currencies must come from actual
active postings, not drawer options unioned with obsolete selected currencies.

Do not restore hidden/unsupported legacy criteria such as transaction status.
Unknown/malformed preference versions fall back safely. Preserve future-version
storage rather than silently overwriting it with older state; unavailable,
blocked or quota-exhausted storage must not block unlock or filter interaction.
No dependencies, domain arithmetic, crypto, vault access or import changes.

Scope is global filters, including perspective/date/search/advanced criteria;
granularity keeps its existing persistence. Local budget/reference selections
and transaction URL sorting/pagination are not global filters and are excluded.

Privacy tradeoff explicitly follows the requested localStorage behavior:
preferences, including search text and legacy identity labels, are unencrypted
browser-local data. Never save passwords, credentials, accounts' labels,
transactions, financial totals, backup content or analytics in that payload.
Lock still clears live sensitive application state; it does not erase the
expressly requested filter preferences.

Source map: `src/application/store/app-store/`,
`src/infrastructure/storage/resilient-app-store-storage.ts`,
`src/domain/analytics/{filters,identity-keys,normalize-backup-dataset}.ts`,
`src/presentation/components/organisms/FilterDrawer/`.
Read-only exploration found no global-filter URL precedence; URL state covers
transaction sorting/page only. Current storage version is 5.

## Tasks and acceptance

- [x] F1 — Implement safe versioned global-filter persistence at the store
  boundary, with test-first staged unlock restoration, dataset reconciliation,
  lock/reunlock/reset behavior, corrupt/unknown/future data, and storage-failure
  handling. Preserve financial outputs, VOID exclusion and existing granularity.
- [x] F2 — Add durable reload/unlock browser regressions with generated fixtures;
  independently verify restored visible controls/results and unavailable-option
  pruning, finish full checks, and deliver the tagged feature to main.

Route: delegated direct for F1 and durable F2 writing (mapping, preparation and
multiple non-trivial source/test files); one writer. Independent verifier for
F2. Parent owns this document, staging, commits and main delivery. No SDD.
Forecast 500–900 authored lines including tests/docs, advisory only; do not
omit tests or split artificially to satisfy a size heuristic. Delivery:
auto-chain/stacked-to-main, coherent work-unit commits, no PR.

Strict TDD enabled by project AGENTS: actual failing focused tests before new
behavior, GREEN then refactor. Installed runner:
`node node_modules/vitest/vitest.mjs run <focused paths>`. Include store,
storage/codec, filters, FilterDrawer and App tests as applicable; full Vitest,
TypeScript node/app/browser, Oxlint zero warnings/errors and whitespace checks.
Parent repeats one reported check. Browser uses only existing source-only
isolated synthetic fixtures; no workspace-wide Node suite/build/private import.

## Safety, review and recovery

Protect byte-identical pre-existing dirty `.atl/.skill-registry.cache.json`,
`.atl/skill-registry.md` and `odd/tasks/pcloud-cli-env.md`. No .env, private
dataset/backups/real vault, user localhost5173, credentials, network installs or
unrelated settings. Existing isolated synthetic import/encryption/build is allowed.

RDD remains enabled, last acknowledged native boundary `a37eabc`; UI task
was independently verified without interactive native consent under the user's
no-interaction requirement. Read-only native diagnostics retain that boundary;
do not fabricate consent/receipts, toggle the switch, or erase pending ranges.
The follow-up is also explicitly autonomous: use independent functional proof,
disclose omitted interactive review, and do not ask for candidate consent.

Engram mirror pending: host has no authoritative registered runtime identity;
agent-attributed memory tools remain prohibited. This file is the recovery record.

## Progress and rollback

Exploration, F1 and independent F2 acceptance complete. The store-boundary approach
uses a separate versioned filter-only storage key, reads it only on successful
unlock, and writes only while analytics is ready. This avoids persisting locked
defaults or mixing filters into the existing granularity migration envelope.

F1 observed RED before source changes: two store regressions failed (preferences
lost through reload/unlock/reset; future app-store version overwritten), with
15 baseline tests passing. Additional oversized-future, selection-truncation and
malformed-envelope regressions each failed before correction. Evidence:
`/tmp/f1-red.log`, `/tmp/f1-{oversize,selection,envelope}-red.log`.

Final focused 57/57, full Vitest 424/424, TypeScript node/app/browser, Oxlint
zero warnings/errors and whitespace checks passed. Parent repeated the exact
57-test check successfully. Source/test scope is four paths, about 501 authored
lines; a coherent store behavior with storage/privacy/availability regressions,
not an artificial file-type split. App integration tests now inject a fresh
store using the same repository/storage adapter, preventing persisted test state
from leaking across cases. One intermediate test-isolation failure was corrected;
the final focused/full runs passed. Browser verification remains F2.

New helper `src/application/store/app-store/filter-preferences.ts` saves only
allowlisted filter fields under `myexpenses-analysis:filters:v1`. Unsupported
future/oversized data is preserved. Current malformed/unsupported snapshots use
safe defaults. Snapshots exceeding 65,536 serialized UTF-16 code units or 100 values in a selection are
discarded as a whole, not partially restored. Legitimate empty custom dates remain;
hidden statuses do not. No financial/crypto/domain changes or sensitive dataset
storage. Evidence: `/tmp/f1-focused.log`, `/tmp/f1-full-final.log`,
`/tmp/f1-tsc-*.log`, `/tmp/f1-oxlint.log`.

F1 work-unit commit `91609a3ed3f7833ab00032359dff9c168dfb1674` is on the feature
branch (638 authored lines including the recovery document). It is not yet
pushed: F2 runtime/independent acceptance precedes main delivery of this feature.
Read-only native assessment against unchanged `a37eabc`: medium, 2,152 accumulated
lines, due/slice-budget. Interactive review omitted under explicit autonomous
scope; no native receipt or boundary advance. Main remains UI delivery `4a019df`.

F2 adds a 223-line durable browser spec and updates two superseded assertions
that previously prohibited the now-authorized preference text in localStorage;
secret/dataset exclusions remain. Two test paths, 231 authored lines. Initial
browser failures were incorrect locators, empty-state row counting and a fixture
amount error (0.25 EUR, not 25); corrected test oracles, no production workaround.
Final targeted browser 15/15, complete isolated browser 132 passed plus three
expected viewport skips, full Vitest 424/424, types three configs, Oxlint and
whitespace checks passed. Writer evidence: `/tmp/f2-browser-full-final.log`,
`/tmp/f2-browser-full-final/`, `/tmp/f2-*-final.log`.

Independent final fresh source snapshot passed new browser 15/15, exact focused
57/57, supplemental monetary/allowlist browser 3/3 across nine combinations, and
pending-preference-read abort/replacement 2/2. Actual Real/Yo results remained
one -0.25 EUR transaction, -0.25 net, 0.25 expense after reload; Deudas remained
zero. Full-dataset availability pruning preserves independent valid criteria;
numeric dataset-local IDs are cleared when the database binding changes. Failed
unlock preserves preferences, correct unlock restores them, reset survives
reload, valid empty custom dates remain, future bytes remain and corrupt input
recovers. Stored allowlist contains no password, account labels, analytics or
transaction payload. Parent repeated browser TypeScript and inspected restored
mobile advanced controls. No confirmed production finding remains.

Independent evidence: `/tmp/f2v-iakn8p92/`, fresh 562-file manifest
`e18b8fe5a7090ff3f707acaf20c072e34a1ca8a92fc94eca4e670b8b2c74ad0d`.
The independent verifier reused writer-observed full-suite/UI/type/lint results;
no retained writer manifest cryptographically binds that full-suite run, and no
such provenance is claimed. Current production matches committed F1 exactly;
independent guards/test checks bind the fresh candidate. Blocked/quota storage
is unit-tested, not tested by exhausting a browser quota. Supplemental external
probe authoring errors were retained and corrected, not production findings.

Delivery includes F1 and F2 only; UI rollback group remains separate. No private
data test, manual screen-reader certification or native interactive approval is
claimed. Unrelated user files remain byte-identical.

F2 work-unit commit `7e42485d9a7ed57be56bd2c41cf4ea0592456e81` includes 280
authored lines with tracking. Running feature count before this closing record:
918 (slightly above the initial forecast, coherent behavior and durable proof,
not grounds to omit tests or create artificial slices). Read-only diagnostic:
medium/due, 2,426 accumulated lines against `a37eabc`. Native boundary unchanged;
no interactive review receipt. Delivery is an authorized fast-forward to main,
normal push and remote SHA confirmation. Both requested features are complete.

## Rollback manifest

| Commit | Work unit |
| --- | --- |
| `91609a3` | Versioned preferences, validated restoration and store lifecycle |
| `7e42485` | Durable reload/unlock guards and final independent proof |
| Tagged `docs(filters): close local preference delivery` | Final delivery record; locate with the exact tag below |

Revert this group only if requested. It does not include the five UI clarity
commits ending at main `4a019df`. No pending implementation remains in this scope.

Locate only this feature's commits:
`git log --oneline --fixed-strings --grep='[filter-persistence-20260930]'`.
Rollback, only if requested, uses new revert commits in reverse order for this
group; no reset/force-push, and do not revert earlier UI clarity changes.
