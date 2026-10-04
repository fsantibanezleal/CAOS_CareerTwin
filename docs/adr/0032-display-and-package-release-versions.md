# 0032: Display and package release versions

Status: accepted, 2026-10-03

CAOS uses padded display versions, for example `0.15.000`. VERSION, the runtime health contract,
changelog, README, Git tag and image release tag must agree exactly. Previous releases used unpadded
versions; their history is preserved.

Package standards prohibit leading zeros: [SemVer](https://semver.org/) defines unpadded numerical
components, and [Chrome manifest versions](https://developer.chrome.com/docs/extensions/reference/manifest/version)
require standards-compatible version numbers. npm, Python distribution metadata and Chrome's
`version` use `0.15.0`, the numerically identical representation. Chrome `version_name` remains
`0.15.000`. This is formatting conversion only, never permission to mismatch release numbers.

Version gates compare packaging to the normalized VERSION, enforce the runtime's exact display
version, check the extension display name and reject partial bumps. The lockfile gate still checks
only root package keys and detects collateral dependency rewrites. Rollback comparisons parse
numbers but live readiness checks exact tag equality.
