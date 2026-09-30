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
- [x] R2 — Integrate optional remembering, automatic restore and revoking locks.
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
candidate review consent. R1 review was granted, approved and acknowledged;
the next reviewed boundary is fba3f15757a4587c3166293e64b0a05a29bab401.

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
  tests/domain/remembered-vault-crypto.test.ts. Commit: fba3f15 (504 authored lines
  including the recovery document). Native high-risk review granted by the user,
  approved with no blockers; acknowledgement consumed review-89f3722571d21926.
  Non-blocking advisory R3-001: add realistic transaction abort/timeout and failed
  revoke coverage with rollback behavior, alongside the pending browser checks.
- Next: integrate R2. Lock must await durable revocation
  before claiming forgotten access, and report failure honestly.
- R2 first candidate implemented opt-in UI, fresh-envelope restore, keyless
  IndexedDB revocation fences, peer notifications and a durable lock marker.
  Writer proof: UI 438/438, crypto 3/3, browser 27/27 and full browser 159 passed
  plus 3 expected skips, all TypeScript projects and Oxlint pass.
- R3 independent first verification is PARTIAL (not acceptance): focused 78/78,
  crypto 3/3 and browser 27/27 passed, but two supplemental probes failed.
  A throwing IndexedDB getter prevents startup; remembered authorization can
  expire while asynchronous filter preferences hydrate before ready is set.
  Evidence: /tmp/r2v-3toe5rt0; manifest
  65dc41b9c7cd8cfd4f9949893621aececfc19aa445b4008ffbf10c6842a09408.
  Both are in-scope corrections before R2 commit; no native R2 review started.
  Transaction abort rollback is browser-proven; real transaction timeout rollback
  remains an explicit verification gap (open timeout is unit-tested).
- Next: correct both reproduced failures with durable regressions, revalidate
  the corrected candidate independently, then assess R2 and deliver.
- Both R2 findings corrected with observed RED then GREEN; startup now catches a
  throwing IndexedDB getter and restored authorization is checked again after
  preference hydration. Wrapped notices use a contained block layout.
  Final writer proof: full UI 440/440, crypto 3/3, all three TypeScript projects,
  Oxlint and diff checks pass; isolated feature browser 30/30. Logs under
  /tmp/r2-correction-*. Full browser 159+3 skips is PRE-correction evidence only.
- R3 independent targeted acceptance PASS: feature browser 30/30, focused tests
  80/80, crypto 3/3, original blocked-getter and late-fence probes now pass;
  changed-vault manual unlock does not silently remember new data. Screenshots
  at 1280/390/320 inspected; parent also inspected 320 and desktop failure UI.
  Evidence /tmp/r2c-3q2yisla; tested 566-file manifest
  f9404fe58c322d3c38b819c3a5f007d8c6eac92bd7b381b302fb672f4edac72c.
  Parent repeated crypto 3/3. No private vault or data accessed.
- R2 rollback boundary: application/repository/storage remembered-access
  integration, UnlockScreen/App hooks and notices, and associated regression
  tests in this work unit. Existing financial math and crypto format unchanged.
  Browser spec includes real IndexedDB key cloning and failed-save/revoke abort
  rollback. Real transaction-timeout rollback remains untested. If both durable
  stores fail during revocation, the user is warned to clear site data; success
  is not claimed. Runtime identity still unavailable; Engram mirror pending.
- Next: commit and assess corrected R2, honor its separate native consent, then
  integrate and push main under the existing user authorization.
