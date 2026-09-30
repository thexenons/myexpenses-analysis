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
- [ ] F2 — Add durable reload/unlock browser regressions with generated fixtures;
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

Exploration and F1 complete; F2 browser acceptance is next. The store-boundary approach
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
safe defaults. Snapshots exceeding 64 KiB or 100 values in a selection are
discarded as a whole, not partially restored. Legitimate empty custom dates remain;
hidden statuses do not. No financial/crypto/domain changes or sensitive dataset
storage. Evidence: `/tmp/f1-focused.log`, `/tmp/f1-full-final.log`,
`/tmp/f1-tsc-*.log`, `/tmp/f1-oxlint.log`.

Locate only this feature's commits:
`git log --oneline --fixed-strings --grep='[filter-persistence-20260930]'`.
Rollback, only if requested, uses new revert commits in reverse order for this
group; no reset/force-push, and do not revert earlier UI clarity changes.
