# Optional remembered vault access

## Intent and authority

Allow repeat visits to unlock the same encrypted vault without retyping its
passphrase, only after explicit per-device opt-in. The user authorized
implementation, commits, integration and push to the existing origin/main.
No private vault, backups, environment secrets or unrelated changes are in scope.

## Design constraints

- Default remains password-based unlock; never persist the password or plaintext.
- Store only a non-extractable, decrypt-only CryptoKey and exact envelope digest
  in origin-local IndexedDB after successful dataset validation.
- Revalidate the fetched encrypted envelope before remembered unlock. Changed
  vaults and missing, corrupt or unavailable storage fall back to manual unlock.
- Explicit lock and the existing 15-minute idle lock revoke remembered access;
  late async work must not restore access or overwrite a newer attempt.
- Explain the trusted-browser consequence briefly beside the opt-in control.
  This is not hardware-backed storage and does not protect against same-origin
  malicious code or someone using the same unlocked browser profile.
- Preserve financial calculations, filter persistence and production crypto
  parameters. No new dependencies or deployment-format migrations.

## Work units

- [x] R1 — Add tested key-based decrypt and resilient remembered-key storage.
  Route: delegated writer (multi-file security logic and preparatory reads).
  Acceptance: exact vault binding, non-exportable decrypt-only keys, safe storage
  failures, unchanged passphrase decryption, no credential persistence.
- [ ] R2 — Integrate optional remembering, automatic restore and revoking locks.
  Route: delegated writer (repository/store/UI lifecycle integration).
  Acceptance: default off, opt-in reload success, changed vault fallback, failed
  unlock cannot save keys, abort/lock races cannot reopen, concise accessible UI.
- [ ] R3 — Independently verify real-browser persistence and delivery.
  Route: delegated verifier (security/lifecycle and browser checks), parent
  structural readback and spot check. Commit tests with their behavior.

## Verification and delivery

Strict TDD is enabled by AGENTS.md: observed RED, GREEN, then refactor.
Runners: Vitest for application tests; tsx --test for domain/security tests;
existing source-only isolated Playwright harness for synthetic browser tests.
Run focused checks first, then UI suite, applicable domain/architecture checks,
three TypeScript projects, Oxlint and git diff --check. Do not read private data
or invoke full deployment builds. Use installed Node 24 and dependencies.

Forecast: approximately 700–1,100 authored changed lines including tests.
Delivery: authorized successive work-unit commits to main (auto-chain,
stacked-to-main semantics; no PR requested). Do not sacrifice tests to fit a
line budget. Tag every commit [remembered-vault-access-20260930].
Base: 25e03eecfb1e0547e6aad8494f0cfa7e11ddbeea.
RDD is on: assess actual work-unit candidates and honor native consent and
continuations without inventing approval. User authorization to push is not a
candidate review consent. No review transaction has started for this feature.

## Recovery

Engram mirror pending: runtime registration unavailable; agent-attributed memory
tools prohibited by the runtime hook. Local document is authoritative progress.
Preserve pre-existing changes in .atl/.skill-registry.cache.json,
.atl/skill-registry.md and odd/tasks/pcloud-cli-env.md.

## Progress

- Source audit completed: key currently transient; PBKDF2/AES-GCM already derives
  non-extractable keys. App revision is optional and is not a vault identity.
- R1 implemented: non-extractable decrypt-only key API, canonical envelope SHA-256,
  generation-guarded serialized IndexedDB read/save/revoke with bounded failures.
  RED evidence: /tmp/r1-crypto-red.log and /tmp/r1-storage-red.log.
  GREEN: domain 3/3, focused Vitest 19/19, all three TypeScript projects,
  Oxlint zero warnings/errors, diff check pass. Parent independently repeated
  domain 3/3. Logs: /tmp/r1-*-freeze.log.
  Real IndexedDB structured cloning remains pending browser verification in R3.
  Rollback: static-vault.ts, remembered-vault-key-storage.ts and its test, and
  tests/domain/remembered-vault-crypto.test.ts. Commit identity pending below.
- Next: assess R1 candidate, then integrate R2. Lock must await durable revocation
  before claiming forgotten access, and report failure honestly.
