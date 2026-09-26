# Documentation accuracy

## Objective

Correct security, deployment, budget, and recovery guidance to match the current implementation without changing application behavior.

## Scope and constraints

- Authorized files: `README.md`, `docs/static-authentication.md`, `docs/pcloud-sync.md`, `docs/backup-features.md`, `deploy/README.md`, and this task document.
- Documentation follows the existing Spanish prose; this tracking document uses English.
- Do not change application code, real deployment state, schedules, data, or unrelated edits.
- The user now explicitly requests local commits of all pending changes; the parent agent owns this task's commit. Pushes and remote operations remain unauthorized.
- Route: delegated direct. Multiple documentation files require coordinated corrections and operational examples; the worker reads, writes, and verifies them together.
- Strict TDD is enabled by `AGENTS.md`; these are prose-only corrections with no product-code changes. Verify documentation and executable examples directly rather than adding product tests.
- Delivery strategy: `ask-on-risk`; initial estimate was under 250 lines. The safe rollback example grew beyond that estimate, but remains one coherent work unit; the approximate 400-line heuristic is not a cap.
- Engram recovery mirror: pending (`unknown_session` from the runtime-provided identity; no session ID was invented or registered).

## Tasks

- [x] DOC-1 — Correct the security, deployment-permission, and budget-status claims against the implementation. Acceptance: the documents distinguish public ciphertext from plaintext confidentiality/integrity, distinguish public release files from private sync state, and state the exact budget thresholds. Checks: source comparison, local Markdown link/anchor check, `git diff --check`.
- [x] DOC-2 — Document a safe rollback and log-retention procedure for pCloud sync. Acceptance: commands identify and validate an exact existing release, perform an atomic symlink replacement without disturbing sync state, account for cron/concurrent sync and future `--force`, and include a concrete log-rotation policy with its limitations. Checks: Bash syntax and safe temporary-directory success/failure exercises; logrotate debug if available; local Markdown link/anchor check; `git diff --check`.
- [x] DOC-3 — Reconcile legacy host-cron recovery guidance with the C02 persistent kernel lease and new Coolify runtime route. Acceptance: rollback safely acquires the same `.sync.lock` flock without unlink/truncation, fails closed for active/unsafe locks and bad release targets, and retains state; prose distinguishes the file-based CLI from Coolify environment secrets and links the two alternative deployment guides from the root README. Checks: observe old rollback RED on an idle persistent lock, then Bash/Node syntax and isolated valid/unsafe/overlap fixtures, link check, `git diff --check`, and scoped logrotate debug.

## Progress and evidence

- Initial repository status includes an unrelated `.atl/.skill-registry.cache.json` edit; preserve it.
- DOC-1 source evidence: `deploy/nginx.example.conf` serves the vault by GET; `scripts/sync-pcloud/orchestrator.ts` uses `0755` for deployment/release roots, `0700` for `.work`, and `0600` for state; `src/domain/analytics/budgets.ts` defines the four documented health states and boundaries.
- DOC-2 source evidence: `scripts/sync-pcloud/orchestrator.ts` compares `current` with saved `releaseId`, publishes the newest backup on mismatch, and `--force` builds a new release. The cron example appends to the log and uses `.cron.lock`.
- Verification: `bash -n` passed for the rollback body. Temporary-directory exercises passed for valid release, missing release, unsafe ID, and active sync lock; `current` stayed unchanged on failures and `.sync-state.json` stayed unchanged on success.
- Verification: 27 local Markdown links/anchors across 12 files passed. `git diff --check` passed.
- Verification: `logrotate --debug` passed on a temporary log/config with the local user substituted. The exact production example could not be checked locally because this machine has no `myexpenses` account; an initial debug run returned `unknown user 'myexpenses'`. No real log was touched.
- Full application tests/build and oxlint were not run: only prose and shell examples changed.
- Work-unit commit evidence: pending parent commit under the user's explicit authorization.
- Independent verification: no blocking findings; nine temporary-directory rollback scenarios passed, including active cron lock, symlink release, missing vault, and invalid `current`. Generated normal/forced release IDs matched the documented validation. Logrotate debug with local substitutions and seven scoped links/anchors also passed.
- Native assessment: `medium`, `review_due: false`, `under_budget` (141 changed lines at assessment). The configuration reason refers to the pre-existing `.atl/.skill-registry.cache.json` change, not these documentation edits. No native approval is claimed.
- DOC-3 corrected after C02: the old rollback example checked that `.sync.lock` did not exist, but C02 retains a safe zero-byte inode even while idle; the old example also serialized only with `.cron.lock`, not the worker lease. The new example opens both locks with `O_NOFOLLOW`, validates descriptor/path identity and metadata, acquires nonblocking kernel leases, retains both descriptors through the atomic `current` swap, and never truncates or unlinks either lock. Cron and Coolify instructions are labeled as alternatives.
- DOC-3 RED: the old documented rollback returned exit 2 with a synthetic valid idle zero-byte `.sync.lock`; `current` and state remained unchanged. The root README was added to the authorized DOC-3 scope for one navigation link.
- DOC-3 GREEN: `bash -n` on the documented wrapper and `node --check --input-type=module` on its body passed. Ten isolated synthetic cases passed: idle persistent lock and safe absent-lock creation succeeded; active sync/cron locks, legacy PID content, lock symlink/hardlink, incomplete release, missing vault, and invalid `current` failed closed. Three additional unsafe cases (lock mode, symlink vault, writable root) failed closed. State was unchanged in every case, failed cases retained `current`, and the existing lock inode was retained on success.
- DOC-3 links: 21 local links/anchors across five changed docs passed. `logrotate --debug` passed against a temporary log/config with the local user substituted; production `myexpenses` account validation remains pending. `git diff --check` passed. No real data, cron, server, or Docker runtime was exercised.
- DOC-3 independent spot check: the exact documented Node body passed isolated idle-lock success, active sync/cron rejection, and PID/symlink/hardlink rejection. The successful rollback retained the lock inode, size and mode; every case preserved state, and every rejection preserved `current`. No lock was unlinked or truncated. `git diff --check` passed. An initial fixture invocation used unavailable `/usr/bin/node`; rerunning with PATH `node` succeeded. No sudo or production-path execution was attempted.

## Next step

Parent review and commit the documentation work unit. On a configured deployment host, validate the production logrotate policy with the `myexpenses` account present. Engram mirror remains pending because the runtime session identity is rejected as unknown.
