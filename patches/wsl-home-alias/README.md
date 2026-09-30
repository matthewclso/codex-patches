# Retired pet home aliases

The historical launcher gave the desktop a POSIX `CODEX_HOME`. During its
initial Windows configuration read Codex normalized that value to a drive-root
Windows path. Two junctions made both the POSIX spelling and its Windows
normalization resolve to the existing Codex data directory.

The composed app-copy pet module now accepts the canonical Windows Codex home
and converts the pet paths to POSIX after selecting the Linux execution backend.
The backend proxy independently passes the canonical POSIX home to the stock
Linux CLI. The old pet-specific junction workaround is excluded; there is no
home-alias code to install. Full desktop startup remains a separate acceptance
check for the toolkit's native-home environment.
