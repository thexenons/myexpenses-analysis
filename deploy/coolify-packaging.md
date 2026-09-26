# Coolify container packaging contract

`compose.yaml` builds two targets from `Dockerfile`: a UID 1000 sync worker and
a UID 101 static nginx server. Coolify should use the normal Docker Compose
build, route the domain to **web:8080** only, and terminate TLS at its proxy.
The web container has no pCloud or vault-passphrase variables. Both images
have read-only root filesystems and no Linux capabilities.
The build context is default-deny: only Dockerfile inputs and the nginx config
are allowed. Known dataset, vault, archive, database, token, passphrase and
environment filename patterns remain excluded inside allowed source directories.

Set `PCLOUD_API_HOST`, `PCLOUD_TOKEN`, and `MYEXPENSES_VAULT_PASSPHRASE` as
Coolify runtime variables. Set exactly one of `PCLOUD_FOLDER_ID` or
`PCLOUD_FOLDER_PATH`; leave the other empty. The worker validates these values
and uses its fixed `/app` repository and `/srv/myexpenses` deployment paths.
The optional interval and cycle timeout default to 3600 and 1800 seconds.
Never provide secrets as Docker build arguments. Docker/Coolify administrators
with runtime access can still inspect container environment values.

The worker creates a new release on the named volume before reporting healthy.
The first volume initialization relies on Docker's normal copy-up of the
worker image's UID 1000-owned `/srv/myexpenses` directory. The web mount uses
`nocopy: true` so it cannot initialize that empty volume instead. Existing
volumes with unsafe ownership or permissions fail closed; do not bypass the
worker's checks with a privileged runtime chown. `.work` remains mode 0700,
while the web UID can read published releases only. Keep `.work`, `releases`,
and `current` on this same volume for atomic publication.

The worker uses one lifetime `flock` lease. Stop the old worker **before**
starting a replacement against this volume; do not scale the worker service.
The readiness marker lives only on worker tmpfs and is created after its own
forced bootstrap succeeds. Compose waits for that health on initial web start;
it does not replace an application-level rolling-update controller. A failed
periodic sync keeps the last complete release served. The 35-minute startup
health window exceeds the default 30-minute cycle timeout, but slow external
operations or custom timeout values may require a longer deployment window.

This packaging has contract tests, not a live container proof: Docker,
Podman, and nginx are unavailable in the current development environment.
The full operator setup, rollback, and smoke-test guide is a separate task.
