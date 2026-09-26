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
| `MYEXPENSES_NOTIFICATION_TO` | Optional single recipient address; required when notifications are enabled. No default. |
| `MYEXPENSES_NOTIFICATION_FROM` | Optional sender and full OVH MX Plan SMTP username; required when notifications are enabled. No default. |
| `MYEXPENSES_SMTP_PASSWORD` | Optional OVH mailbox password; required when notifications are enabled. No default. |

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

## Backup email notifications

Leave all three notification variables empty to disable mail. To enable it,
configure all three as worker-only Coolify **runtime** variables, with Build OFF
and Literal ON. Store the SMTP password as a secret. The intended mailbox is
`notifications@xenosoul.com` and the requested recipient is
`jaume97.cs@gmail.com`; enter both in Coolify rather than source code. The
worker connects to `smtp.mail.ovh.net:587` and requires STARTTLS with normal
certificate validation. Hetzner Cloud blocks outbound port 465 by default;
port 587 is available for external SMTP. Do not expose these variables to the
web service or build subprocess.

On the first successful processing after initial enablement, the worker queues
an email even if that backup was already synchronized before notifications
were configured. Later forced rebuilds of the same backup do not add alerts.
Each subsequently observed new backup adds one alert. The worker attempts one
pending email per cycle; an SMTP failure does not undo a published backup or
clear readiness. Pending alerts survive restarts and disabled periods. They
are sent to the recipient configured **when delivery occurs**, not when queued.
Messages contain no backup or financial details, and logs report only generic
delivery status.

SMTP acceptance is not proof that the recipient received the message. A crash
after SMTP acceptance but before state acknowledgement can result in a
duplicate. The notification ledger is stored as an optional field in the
private sync state; older worker versions reject that field. Preserve the
current worker version or prepare a state-compatible rollback before enabling
mail. Test the integration with an injected fake sender in local checks; do
not send live test mail without separate authorization.

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
