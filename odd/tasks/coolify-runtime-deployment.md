# Coolify runtime deployment

## Objective

Deploy the private GitHub repository through Coolify Docker Compose with an
isolated sync worker and non-root static web service. Configure the integration
entirely through Coolify runtime variables, without manually creating configuration
or secret files inside the deployment.

## Problem and approach

The existing pCloud CLI already downloads, imports, encrypts, builds and atomically
publishes releases. Nixpacks static deployment hooks cannot provide its runtime
requirements. Reuse that pipeline, preserve the JSON-file CLI, and add a typed
environment adapter with in-memory credentials rather than shell/JSON interpolation.

## Authorized scope and constraints

- Local implementation, tests, documentation and work-unit commits are authorized.
- No remote server access, real pCloud calls, credentials inspection, push, PR or
  deployment is authorized by this task.
- Preserve existing modified documentation, registry cache, and the separate
  `odd/tasks/documentation-accuracy.md` work.
- Secrets belong only to the worker runtime; never inject them into the image
  build, frontend, web container, subprocess build environment or logs.
- Privileged Coolify/Docker administrators can inspect runtime environment values;
  document this limitation instead of promising secret-vault isolation.
- Keep private work and release publication on one filesystem for atomic rename.
- No simultaneous old/new worker versions publishing to the same deployment root.
- Docker and Podman are not installed locally. Container execution checks remain
  pending unless an explicitly authorized local runtime becomes available.

## Delivery and verification policy

- Branch: `main`; base: `2fb0387`. The user explicitly requested direct main
  integration, overriding the default feature-branch workflow.
- Route: delegated direct implementation, one writer at a time.
- Strict TDD: enabled by user-supplied AGENTS instructions; observed RED before
  implementation, then GREEN and refactor.
- Runner: `pnpm exec tsx --test <focused-test-path>`; full Node suite:
  `pnpm test:node`. Also `pnpm type-check` and `pnpm lint`.
- Receipt-driven development: on, from the global user preference. Candidate
  consent and provider-issued review transitions remain required where applicable.
- Delivery strategy: incremental work units integrated directly into local `main`,
  explicitly selected by the user. No pull requests or remote operations requested.
- Revised forecast: roughly 2200-2800 authored changed lines including regression
  tests, infrastructure and guide. C02 requires one coherent cross-process
  lifecycle boundary and its crash/shutdown tests; splitting by file type would
  leave that behavior incomplete. This is an estimate, not a per-task hard cap.
- Commits: C01 `636368f` (471 authored changed lines), C02 `ff62398` (1153).
  Running authored total: 1624 lines. No push/PR will be created without
  separate authorization. The delivery choice is resolved; do not ask again.

## Tasks

- [x] C01: Add validated environment configuration and in-memory secret loading,
  preserving the existing JSON CLI. Cover literal characters, selector conflicts,
  missing/invalid values, redacted failures and child-environment isolation.
  Route: delegated; new logic and compatibility tests span multiple files.
  Evidence: observed RED then GREEN; 7 runtime tests, 27 affected regressions,
  type-check and lint passed. Independent spot check: 14 runtime/config/CLI tests
  and type-check passed. Commit: `636368f`. Native assessment: medium, review due
  (slice budget reached). User granted review; reliability lens found no defects;
  exact acknowledgement consumed the authority for `review-d44cfaba2729d616`.
- [x] C02: Make the worker lifecycle safe for containers: shared writer exclusion,
  stale-lock recovery, cancellation, serial execution, new-code bootstrap and
  readiness. Periodic syncs must not force unchanged backups. Cover restart,
  overlap, abort and failed-update behavior with observed tests.
  Route: delegated; concurrency and lifecycle logic span multiple files.
  Design refinement: one automatic serial interval loop holds a kernel-backed
  lifetime lease; no manually configured cron or Coolify Scheduled Task. All
  one-shot writers must honor the same lease. Build children retain a duplicate
  lease descriptor; shutdown waits for their exit before cleanup/release.
  Evidence: observed RED before lease/worker/child implementation, then GREEN.
  Proved helper FD-sharing locally (owner acquisition 0, separate contender 75
  after helper exit, contender 0 after owner close). Focused lease, worker,
  orchestrator and build tests passed; final `pnpm exec tsx --test
  "scripts/sync-pcloud/*.test.ts"` passed 56/56, `pnpm type-check`, `pnpm lint`
  and `git diff --check` passed. A timing-dependent child abort test failed once
  before the fixture waited for child readiness; the corrected test then passed
  in the full suite. Linux child-process fixtures cover SIGKILL inheritance,
  TERM-style abort cleanup, overlap, stale-lock recovery, forced bootstrap,
  nonforced serial retries and readiness. Container execution remains pending.
  Migration: a non-empty legacy PID lock fails closed; stop legacy writers
  before removing it. C03 must provide `/usr/bin/flock` and private
  `/run/myexpenses` readiness storage.
  Reopened after independent spot check: aborted build returns when its direct
  child exits, cancelling escalation while a same-group grandchild continues
  writing. Original 56/56 suite did not cover this descendant failure path.
  Correction evidence: permanent descendant regression failed RED with a live
  grandchild after rejection; after the fix, focused `process-backup.test.ts`
  passed 8/8 and the full sync-pCloud suite passed 58/58. Type-check, lint and
  `git diff --check` passed. An intermediate full run failed 1/58 because
  shutdown could not be verified; unknown `/proc` scan outcomes now conservatively
  keep the group in the live state and retry. A fresh-path copy of the independent
  reproducer exited 0: return after ~5.1s, no live grandchild or early lease
  reacquisition. Normal direct-child exit with a live same-group writer also
  fails only after that group stops. TERM-to-KILL escalation is bounded;
  uninterruptible kernel tasks may prolong the safety-first wait. Descendants
  detached into another process group are outside this process-group guarantee.
  Independent final recheck: 58/58 tests and type-check passed. The same
  cancellation probe kept the competing lease blocked while the descendant was
  alive, returned after 5120ms with no live descendant, then allowed reacquisition.
  Container execution remains pending.
  Commit: `ff62398`. Native assessment: high (`process_boundary`). User granted;
  four lenses approved with a nonblocking duplicate readiness-path advisory.
  Exact acknowledgement consumed `review-ad0dbbcb1f4e1b5a`; that candidate is
  closed. Address the advisory separately during C03 health integration.
- [x] C03: Package worker and non-root web service with Compose, reproducible
  dependency installation, persistent storage ownership, read-only web mounts,
  runtime-only secrets, nginx policy and healthchecks. Keep private work and
  release staging on the same filesystem. Add deployment contract tests.
  Route: delegated; coordinated infrastructure files and security checks.
  Readiness follow-up: acquire writer ownership before removing a marker; a
  rejected second worker sharing that path must preserve the owner's readiness.
  Add a failing two-worker regression before the fix. This is a new candidate,
  not a reopening of the completed C02 review.
  Evidence: observed RED in the focused suite (4/10 failures: absent packaging
  files and a rejected contender deleting the owner's readiness), then GREEN.
  Added a cleanup-error lease-release check. Focused tests passed 11/11; full
  sync-pCloud tests passed 63/63; type-check, lint and `git diff --check`
  passed. PyYAML parsed the Compose file and verified service/volume structure.
  Parent structural readback found the full nginx configuration omitted MIME
  mappings; with `nosniff`, module assets would not load. A new contract check
  failed RED, then passed after including nginx's MIME table with an
  `application/octet-stream` fallback. Focused 11/11, full sync-pCloud 63/63,
  type-check, lint and diff checks passed again after this correction.
  Build-context privacy follow-up: changed `.dockerignore` from a denylist to
  default-deny with only Dockerfile input trees and the nginx config allowed;
  private dataset/credential/archive/database patterns override those trees.
  Contract test failed RED on the prior denylist, then focused tests passed
  11/11 with type-check, lint and diff checks. Actual Docker context transfer
  remains unverified without Docker.
  Docker, Podman and nginx are unavailable, so image build, Compose runtime,
  nginx syntax and health behavior remain pending live-container proof. This
  task is locally complete, pending its work-unit commit and native assessment.
  Independent final spot check passed 11/11 focused tests and type-check. A
  bounded inventory confirmed the final ignore rules retain all 475 inputs
  used by the successful synthetic builds plus nginx configuration, with zero
  missing inputs or source-tree JSON files. This is not Docker execution proof.
- [ ] C04: Deliver the exact Coolify setup and recovery guide; run full applicable
  local checks and record container/live-environment limitations explicitly.
  Include bootstrap, noop, new backup, code update, restart, rollback, secret
  isolation and financial smoke-test acceptance steps.
  Route: delegated writing and independent verification.
  Early functional proof: the independent synthetic harness passed nine checks
  with the real environment adapter, injected pCloud transport, import, encryption,
  TypeScript, Vite and atomic publication. Three successful builds covered initial
  deployment, forced same-backup code updates and a changed SQLite backup. Noop
  skipped download/build; an expected compiler failure preserved current/state/
  releases. Decryption, child environment and asset/log secret canaries, 3097
  atomic visibility samples and four-account/11-posting financial checks passed.
  Zero noninjected network calls; synthetic source/data/releases were cleaned.
  Reusable proof: `/tmp/myexpenses-coolify-proof-xmx8Ph/proof.mts` and its
  `report.json`/`final-context-inventory.json`. Local dependencies were reused;
  image installation and live container semantics remain unverified.

## Acceptance criteria

- A fresh checkout needs only Coolify configuration, not manual files or edits
  inside a running container.
- Initial data processing succeeds before the worker reports its new version ready.
- Periodic updates publish only complete validated releases; failures preserve the
  previous release and are observable.
- Workers cannot delete another active worker's workspace or republish old code
  after a newer deployment through unsafe overlap.
- Web receives no credentials and cannot read private work contents with its UID.
- The existing file-based CLI remains supported.
- Every claimed check has an observed result; unavailable runtime proof stays pending.

## Progress and next step

C01 and C02 are committed, functionally verified and independently reviewed.
The last reviewed boundary is `ff62398e05a8add074694bd57d8421ea9c7c9fd0`.
The C03 packaging and readiness fix are implemented and locally checked; next:
commit and native assessment/review, then the C04 operator guide and durable
integration checks using the successful independent synthetic proof.
Existing unrelated changes remain untouched. The functional verifier confirmed
that Docker, Podman and nginx are absent from PATH; no live container test ran.

Engram mirror: pending. Writes currently fail with `unknown_session` even when
`session_id` is omitted; no identity has been invented or registered.
