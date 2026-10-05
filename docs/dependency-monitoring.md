# Review dependency updates and advisories

Dependency monitoring runs weekly on Monday at 05:37 UTC and can be started
manually from **Actions → Dependency monitoring → Run workflow**. Reports stay
in Actions logs. No automatic updates or auto-merge are configured.

## Read the reports

| Signal | Meaning | Next action |
| --- | --- | --- |
| Outdated JSON entries | Newer versions exist for direct production, development or optional packages; this is not a vulnerability verdict. | Review release notes and compatibility before a separately authorized update. |
| Audit advisories | Known vulnerabilities affect the installed dependency graph, including development and transitive dependencies. | Review package/version, severity, dependency path and advisory URL; test a separately authorized fix. |
| Registry or setup errors | Monitoring could not complete reliably; absence of a report is not a clean result. | Diagnose the failed step and rerun after recovery. |

The native commands are `pnpm outdated --json` and `pnpm audit --json`, without
production-only filters, ignored advisories or registry-error suppression. With
pnpm 12.6.0, a successful outdated query with available updates was observed to
exit 1; that failed step signals updates, **not necessarily security issues**.
Inspect its JSON or error output to distinguish updates from a failed query.
Native exit codes are preserved. Audit still runs after outdated fails, provided
locked dependency setup succeeded; both reports can therefore inform the same
run even when the overall workflow fails. No clean advisory claim is made when
setup fails or the registry is unavailable.

## Why package updates are report-only

The repository uses **pnpm 12.9.1**. GitHub's documented Dependabot support lists
**pnpm versions 7–10**, not version 12 (checked 2026-10-03). Consequently, no
`npm` ecosystem entry is configured for this lockfile. Native pnpm monitoring
covers the support gap without pretending automatic package-update PRs work.
Recheck official support before enabling a package updater or changing managers.

Dependabot is configured only for GitHub Actions: weekly grouped version-update
PRs, with at most two open version-update PRs. Review every action's source and
release before merging. Keep action references pinned to 40-character commit
SHAs; existing architecture checks reject unpinned actions in CI. Grouping reduces
PR noise but does not remove the need to inspect each action change.

## References

- [Dependabot ecosystem and SHA-pinned action support](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)
- [Dependabot grouping and version-update limits](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [pnpm outdated](https://pnpm.io/cli/outdated) and [pnpm audit](https://pnpm.io/cli/audit)
- [GitHub Actions status functions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions)
