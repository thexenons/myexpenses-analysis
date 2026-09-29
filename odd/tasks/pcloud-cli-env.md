# Environment-only pCloud CLI

## Objective and authorized scope

The CLI recovers the newest pCloud backup into the project's `data/` directory,
using pCloud environment variables and automatic `.env` loading. It must not
import, encrypt, build, publish or send mail. The worker retains its complete
deployment flow. The user explicitly clarified and authorized this separation
on 2026-09-29; the previously retained CLI deployment behavior was a mistaken
assumption, not the intended local workflow. TDD remains explicitly enabled.

## Constraints and decisions

- Share only pCloud source/credential validation. CLI must not require or validate
  worker-only vault, repository/deployment roots, timezone, timing or SMTP values.
  Add no dependency. Preserve worker validation and behavior.
- Missing `.env` is allowed with externally supplied variables. Other read errors
  must fail safely. Preserve secret redaction and build-child isolation.
- Do not read, overwrite, stage, or execute the user's existing `.env`.
- No real pCloud requests, SMTP, deployment or pull request is authorized. User
  requested a Git push after T2 commit; destination/authentication confirmation
  and native candidate review consent remain separate pending gates.
- Preserve existing unrelated `.atl` registry changes.
- Worker scheduling and notification delivery remain unchanged.
- Preserve timestamp ZIP filenames and all unrelated local backups/datasets.
  Matching local backup: verify checksum then skip. Different same-name content:
  fail safely unless `--force` explicitly requests re-download/replacement.
- Download atomically using existing verified pCloud transport; reject unsafe
  destination symlinks and clean partial files on failure/cancellation. Do not
  overwrite a concurrently created destination without force.
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
- Running committed authored lines: 488 (+382/-106 across 15 files).
- Work-unit commit: `5b0491373c8333bd8170955a25c333cede6506b3`
  (`feat(pcloud): load CLI configuration from environment`).
- This post-commit evidence update is intentionally uncommitted: the user
  authorized one local commit, not history rewriting or a second commit.
- Implementation/docs authored diff: 393 lines, plus this recovery document.
  The complete deliverable exceeds approximately 400 lines. One cohesive work
  unit is retained: splitting the unused environment helper from its CLI
  integration would not produce an independently useful behavior. The user
  accepted the single-unit size exception.
- Rollback boundary: CLI environment loading/parsing, its tests, `.gitignore`,
  environment example and affected deployment instructions only.
- T2 forecast: approximately 600–1,000 authored lines including regression tests
  and retiring obsolete CLI deployment instructions. Size is advisory; do not
  compress tests/docs or add artificial slices. Prior single-commit/size approval
  covered T1. User subsequently approved the second local T2 commit with a size
  exception and requested push on 2026-09-29.
- T2 review base: `5b0491373c8333bd8170955a25c333cede6506b3`. Prior review does not
  approve this new behavior.
- T2 measured implementation/test/doc diff: 16 files, +660/-590 = 1,250 authored
  lines, excluding this task record and unrelated `.atl` changes. Removing
  obsolete CLI deployment/cron documentation accounts for substantial churn.
  Keep the coherent correction with its tests and accurate operating guidance;
  do not discard tests or compress code to meet the advisory estimate. The second
  commit/size exception is approved; independent native review remains pending.

## Task

- [x] T1 — Migrate the one-shot CLI, regressions and operational examples together.
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
  - Implementation, functional acceptance and work-unit commit observed; native
    review consent explicitly granted by the user on 2026-09-29.
  - Native assessment: high (`process_boundary`, isolated subprocess test).
    The isolated committed assessment used base
    `dd2f95f47f090c2723bb7910e6ef403276dbdcfc` and `--committed-only`; `.atl`
    edits and the real `.env` are excluded. Review was due (`high_risk`);
    the post-acknowledgement assessment reports `review_due: false` and
    `review_due_reason: already_reviewed`.
    Native risk, resilience, readability and reliability reviewers each returned
    zero findings. The last capture approved the candidate; the exact
    `review acknowledge-approved` command returned `acknowledged` with authority
    `burned`. Reviewed boundary advances to the work-unit commit above.
    Review was static over the 15 immutable patches; reviewers did not rerun
    tests or independently inspect unchanged configuration/pipeline internals.
    Target: `sha256:e49b0f393e2d7f2fa477f73d489394a40b593e2c1f7654af38a56414f50ae20d`.
    Lineage: `review-0af5c29416c8e869`.
    Acknowledged revision: `sha256:c5f850af1e784c558ce75d90ddddbecef55a8683dd6b1ef41ffef29f7ed5bb27`.

- [ ] T2 — Separate local backup recovery from worker deployment.
  - Route: delegated direct; mapping/preparation exceeds four files and writer
    touches multiple non-trivial files. Preserve valid T1 env-loading behavior;
    replace only its now-superseded full-deployment CLI wiring/assertions/docs.
  - Source-only settings: `PCLOUD_API_HOST`, `PCLOUD_TOKEN` and exactly one of
    `PCLOUD_FOLDER_ID`/`PCLOUD_FOLDER_PATH`; reuse validation with worker.
  - CLI downloads newest valid ZIP into `resolve(cwd, "data")` with original name.
    No JSON config, vault requirement, deployment tree, import, encryption,
    build, web publication, scheduler or SMTP.
  - Preserve `.env` automatic loading/export precedence and `--force` (now
    re-download only). Failed/cancelled transfers must not damage local files.
  - RED/GREEN: minimal source-only configuration, original filename/data output,
    ignored worker-only invalid values, same-name checksum/noop/collision/force,
    integrity failure, cancellation/cleanup, symlink safety and secret redaction.
  - Keep unchanged worker behavior covered by runtime-config/worker/orchestrator
    suites. Isolated CLI subprocess checks must use synthetic cwd/env only.
  - Update README/local instructions/template and remove obsolete claims that
    CLI or its cron example deploys. Manual import/encrypt/dev commands remain
    independent; worker/Coolify deployment instructions remain valid.
  - Checks: focused sync suite, `pnpm test:node`, `pnpm type-check`, `pnpm lint`,
    and `pnpm test:deployment` (isolated harness, never live credentials).
  - Rollback boundary: source config extraction, local download/CLI wiring,
    matching tests and documentation. No data, worker workflow or dependencies.
  - RED observed before production edits: `pnpm exec tsx --test
    scripts/sync-pcloud/cli.test.ts` ran 16 tests with eight expected failures
    because source-only local recovery still required worker vault/deployment
    configuration. Temporary log: `/tmp/pcloud-download-red.log`.
  - GREEN: focused sync suite passed 97/97; temporary log
    `/tmp/pcloud-download-focused.log`.
  - Full `pnpm test:node`: 284 tests, 281 passed, zero failed, three skipped for
    missing private backup/reference datasets. Log:
    `/tmp/pcloud-download-node-tests.log`.
  - `pnpm test:deployment`: 1/1 passed in approximately 22 seconds. It stages
    source without real `.env`/private backups, uses synthetic SQLite/ZIP and
    mocked pCloud transport, and executes the preserved import/encrypt/build/
    atomic-publication pipeline. This is not a live pCloud or Docker deployment.
    Log: `/tmp/pcloud-download-deployment-tests.log`.
  - `pnpm type-check`, `pnpm lint`, `git diff --check`, relative documentation
    links, and ignore checks for `.env`, backup ZIPs and staging all passed.
  - Implementation/functionality observed complete; checkbox remains open for
    commit/delivery and native review. No additional commit/staging performed.
  - Native review pending a new committed candidate and user consent. T1 review
    must not be represented as approval of this changed local workflow.

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

Create the authorized T2 commit, assess its isolated committed candidate and
follow native review consent. Confirm push destination/authentication before
remote use. After push, investigate the period-selector label overflow on desktop
and mobile read-only; the user has not requested a style implementation yet.
No PR, merge or real sync is authorized. Mirror remains pending due to Engram
session failure.
