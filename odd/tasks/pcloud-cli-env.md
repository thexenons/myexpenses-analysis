# Environment-only pCloud CLI

## Objective and authorized scope

Replace the standalone CLI's JSON `--config` interface with the worker's existing
environment variables. Automatically load `.env` from the command working
directory without overriding exported variables; ignore `.env` in Git. Keep the
one-shot execution model and `--force`. Update affected tests and operational docs.
The user explicitly approved TDD on 2026-09-29.

## Constraints and decisions

- Reuse `loadSyncPCloudRuntimeConfig`; add no dependency.
- Missing `.env` is allowed with externally supplied variables. Other read errors
  must fail safely. Preserve secret redaction and build-child isolation.
- Do not read, overwrite, stage, or execute the user's existing `.env`.
- No real pCloud requests, SMTP, deployment, push, or pull request is authorized.
- Preserve existing unrelated `.atl` registry changes.
- Worker scheduling and notification delivery remain unchanged.
- TDD: enabled by explicit user reply; runner: `pnpm exec tsx --test`.
- RDD: on, source global (`gentle-ai review mode status`). Candidate consent and
  native transitions remain required; no fabricated approval.

## Delivery

- Route: delegated direct. Mapping/preparation involved more than four files;
  implementation involves multiple non-trivial source/test/doc files.
- Base: `dd2f95f47f090c2723bb7910e6ef403276dbdcfc`.
- Feature branch: `feat/pcloud-cli-env`.
- Forecast: approximately 350–500 authored changed lines, no generated files.
- Strategy: `exception-ok`; user explicitly approved one local commit with a
  size exception on 2026-09-29. No chain or remote operation is authorized.
- Commit authorization: explicit user approval; preserve unrelated `.atl` edits
  and exclude the real `.env`. Native review consent remains separate.
- Running committed authored lines: 0. Commit: pending.
- Implementation/docs authored diff: 393 lines, plus this recovery document.
  The complete deliverable exceeds approximately 400 lines. One cohesive work
  unit is retained: splitting the unused environment helper from its CLI
  integration would not produce an independently useful behavior. The user
  accepted the single-unit size exception.
- Rollback boundary: CLI environment loading/parsing, its tests, `.gitignore`,
  environment example and affected deployment instructions only.

## Task

- [ ] T1 — Migrate the one-shot CLI, regressions and operational examples together.
  - Route: delegated writer (multiple non-trivial files).
  - Observe RED before production edits, then GREEN and refactor as needed.
  - Accept no CLI arguments by default; reject `--config`; preserve `--force`.
  - Load `.env` automatically; exported values, including empty ones, win.
  - Use exactly the worker configuration names and validation, with runtime
    secrets supplied in memory rather than through legacy secret files.
  - Cover quoting/comments, missing file, read errors, invalid configuration,
    secret-safe output, force propagation and mocked successful one-shot sync.
  - Ensure `.env` is ignored and a safe example remains trackable.
  - Update cron and migration docs, including local repository-root requirement.
  - Checks: focused sync suite, `pnpm test:node`, `pnpm type-check`, `pnpm lint`;
    isolated subprocess CLI check without live credentials/network.
  - Implementation and functional acceptance observed; commit/review closure
    remains pending, so this task is not marked complete.
  - Native assessment: high (`process_boundary`, isolated subprocess test).
    Workspace assessment includes pre-existing `.atl` edits; it grants no
    authority. Review must target only this work-unit commit, with native
    candidate consent. No review has been started.

## Progress and evidence

- Read-only mapping complete. Existing `.env` was untracked; it is now ignored
  (`git check-ignore .env`). The safe example is not ignored.
- Baseline: `pnpm type-check && pnpm lint` passed before implementation.
- RED observed before production edits: `pnpm exec tsx --test
  scripts/sync-pcloud/cli.test.ts scripts/sync-pcloud/cli-environment.test.ts`
  exited 1 with three failures: no-argument parsing still required `--config`,
  mocked pipeline failed before reaching its error, and the environment module
  did not yet exist.
- GREEN: `pnpm exec tsx --test 'scripts/sync-pcloud/*.test.ts'` passed 81/81.
- Full `pnpm test:node`: 268 tests, 265 passed, zero failed, three skipped because
  optional private backup/reference datasets are absent. Log:
  `/tmp/pcloud-cli-env-node-tests.log` (temporary, not a deliverable).
- `pnpm type-check`, `pnpm lint`, and `git diff --check` passed after edits.
- Runtime harness: `main.test.ts` spawns the actual CLI with an empty environment
  and temporary synthetic `.env`, verifies validation and safe failures without
  network. Mocked CLI tests verify publication, unchanged backup and force.
- Real synchronization, SMTP and deployment were intentionally not run. No
  production build or browser/UI suite was run: no frontend/pipeline changes.
- No new dependencies; `node:util.parseEnv` parses local data without shell
  execution or mutation of `process.env`. Worker implementation is unchanged.
- Engram mirror pending: prior writes fail `unknown_session` despite omitting
  `session_id`; preserve this file as the recovery record.

## Next step

Create the authorized single local commit, assess that isolated committed
candidate, and follow native review consent/transitions. Mirror remains pending
due to Engram session failure.
