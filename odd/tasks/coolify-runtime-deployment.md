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
- Forecast: roughly 600-1000 authored changed lines including regression tests,
  infrastructure and guide. This is a planning estimate, not a per-task hard cap.
- Commits/published PRs: none for this feature. No push/PR will be created without
  separate authorization. The delivery choice is resolved; do not ask again.

## Tasks

- [x] C01: Add validated environment configuration and in-memory secret loading,
  preserving the existing JSON CLI. Cover literal characters, selector conflicts,
  missing/invalid values, redacted failures and child-environment isolation.
  Route: delegated; new logic and compatibility tests span multiple files.
  Evidence: observed RED then GREEN; 7 runtime tests, 27 affected regressions,
  type-check and lint passed. Independent spot check: 14 runtime/config/CLI tests
  and type-check passed. Commit identity will be recorded after commit creation.
- [ ] C02: Make the worker lifecycle safe for containers: shared writer exclusion,
  stale-lock recovery, cancellation, serial execution, new-code bootstrap and
  readiness. Periodic syncs must not force unchanged backups. Cover restart,
  overlap, abort and failed-update behavior with observed tests.
  Route: delegated; concurrency and lifecycle logic span multiple files.
  Design refinement: one automatic serial interval loop holds a kernel-backed
  lifetime lease; no manually configured cron or Coolify Scheduled Task. All
  one-shot writers must honor the same lease. Build children retain a duplicate
  lease descriptor; shutdown waits for their exit before cleanup/release.
- [ ] C03: Package worker and non-root web service with Compose, reproducible
  dependency installation, persistent storage ownership, read-only web mounts,
  runtime-only secrets, nginx policy and healthchecks. Keep private work and
  release staging on the same filesystem. Add deployment contract tests.
  Route: delegated; coordinated infrastructure files and security checks.
- [ ] C04: Deliver the exact Coolify setup and recovery guide; run full applicable
  local checks and record container/live-environment limitations explicitly.
  Include bootstrap, noop, new backup, code update, restart, rollback, secret
  isolation and financial smoke-test acceptance steps.
  Route: delegated writing and independent verification.

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

C01 implemented and functionally verified; native review/commit evidence pending.
Next: close C01 under the configured review policy, then implement C02.
Existing unrelated changes remain untouched. The functional verifier confirmed
that Docker, Podman and nginx are absent from PATH; no live container test ran.

Engram mirror: pending. Writes currently fail with `unknown_session` even when
`session_id` is omitted; no identity has been invented or registered.
