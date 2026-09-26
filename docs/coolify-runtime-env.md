# Runtime pCloud configuration

The container worker will consume these **runtime-only** Coolify variables. This
contract is separate from the existing `deploy:sync-pcloud --config <absolute-path>`
JSON-file CLI, which remains supported. The periodic worker and Compose wiring
are separate deployment tasks; this module alone does not start synchronization.

| Variable | Requirement |
| --- | --- |
| `PCLOUD_API_HOST` | Required: `api.pcloud.com` or `eapi.pcloud.com`; choose the account's region explicitly. |
| `PCLOUD_FOLDER_ID` | Exactly one folder selector; unsigned decimal pCloud ID (up to uint64). |
| `PCLOUD_FOLDER_PATH` | Alternative selector: safe absolute pCloud folder path. |
| `PCLOUD_TOKEN` | Required pCloud access token. |
| `MYEXPENSES_VAULT_PASSPHRASE` | Required static-vault passphrase. |
| `MYEXPENSES_TIME_ZONE` | Optional IANA time zone; defaults to `Europe/Madrid`. |
| `MYEXPENSES_DEPLOY_ROOT` | Optional absolute path; defaults to `/srv/myexpenses`. |
| `MYEXPENSES_REPOSITORY_ROOT` | Optional absolute path; defaults to `/app`. |
| `MYEXPENSES_SYNC_INTERVAL_SECONDS` | Optional sequential retry interval, 30–86400 seconds; defaults to 3600. |
| `MYEXPENSES_SYNC_TIMEOUT_SECONDS` | Optional per-cycle timeout, 30–86400 seconds; defaults to 1800. |

Compose may declare both folder variables with empty defaults. An empty selector
is treated as unset; exactly one must contain a valid ID or path. Setting both
to non-empty values, or leaving both empty, fails validation.

Set token and passphrase as Coolify runtime secrets on the worker service only.
The loader validates and passes their exact values in memory; it does not trim,
expand shell variables, interpolate JSON, or create credential files. The build
subprocess receives an explicit allowlisted environment without these variables.
Container administrators can still inspect runtime environment values; this is
not isolation from privileged operators. Do not set these secrets at image build
time or on the web service.

The worker performs one forced bootstrap before writing `/run/myexpenses/ready`,
then serial non-forced cycles. The readiness directory must be a private runtime
directory supplied by the container. Shutdown removes the marker. The worker and
one-shot CLI share a persistent Linux `flock` lease at `<deploy-root>/.sync.lock`;
the image must provide util-linux `/usr/bin/flock`. Stop all legacy PID-lock
writers before migrating and remove an old non-empty PID lock only after they
have stopped. Never run old and new workers against the same deployment root.
On build cancellation, the worker escalates from TERM to KILL after five seconds
and waits for live processes in the build's process group to stop before cleaning
its workspace or releasing the lease. Escalation is bounded, but total shutdown
cannot be guaranteed if a process is stuck in an uninterruptible kernel state;
the container stop grace period is a separate operational boundary.
