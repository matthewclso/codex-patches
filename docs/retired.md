# Retired workarounds

## GraphQL shell guard

The historical launcher exported self-referential GraphQL variables from
`BASH_ENV` to compensate for expansion through nested Bash shells.

Codex app build `26.928.20755` uses single-quote argument escaping in both the
GitHub command generator and the outer WSL command generator in
`.vite/build/worker.js`. A disposable fake `gh` captures the original GraphQL
query through the generated nested Bash command without the variable guard.
The existing workaround is therefore excluded from the current toolkit.

`tools/audit-graphql.cjs` preserves the source-bound regression check. A new
version whose command-generator structure changes must be audited again; a
missing anchor does not establish that a workaround is needed or fixed.

## Pet home aliases

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
